const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);

const validGames = new Set(["klondike", "spider", "freecell", "minesweeper"]);
const validModes = new Set([
  "klondike-draw-1",
  "klondike-draw-3",
  "spider-1-suit",
  "spider-2-suit",
  "spider-4-suit",
  "freecell-standard",
  "minesweeper-beginner",
  "minesweeper-intermediate",
  "minesweeper-expert",
]);

module.exports = async function handler(request, response) {
  try {
    if (!process.env.DATABASE_URL) {
      return sendJson(response, 500, { error: "DATABASE_URL is not configured." });
    }

    if (request.method === "GET") return getRankings(request, response);
    if (request.method === "POST") return createRanking(request, response);

    response.setHeader("Allow", "GET, POST");
    return sendJson(response, 405, { error: "Method not allowed." });
  } catch (error) {
    return sendJson(response, 500, { error: "Ranking request failed." });
  }
};

async function getRankings(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const overall = url.searchParams.get("overall") === "true";
  const limit = clamp(Number(url.searchParams.get("limit") || 10), 1, 100);

  if (overall) {
    const rows = await sql`
      with best_per_mode as (
        select distinct on (r.user_pk, r.game, r.mode)
          r.user_pk, u.user_id, u.nickname, r.game, r.mode, r.score, r.seconds, r.moves, r.created_at
        from ranking_records r
        join users u on u.id = r.user_pk
        where r.won = true
        order by r.user_pk, r.game, r.mode, r.score desc, r.seconds asc, r.moves asc nulls last, r.created_at asc
      )
      select
        user_id,
        nickname,
        sum(score)::int as total_score,
        count(*)::int as completed_modes,
        sum(seconds)::int as total_seconds,
        sum(coalesce(moves, 0))::int as total_moves
      from best_per_mode
      group by user_pk, user_id, nickname
      order by total_score desc, completed_modes desc, total_seconds asc
      limit ${limit}
    `;
    return sendJson(response, 200, { rankings: rows });
  }

  const game = url.searchParams.get("game");
  const mode = url.searchParams.get("mode");
  if (!validGames.has(game) || !validModes.has(mode)) {
    return sendJson(response, 400, { error: "Valid game and mode are required." });
  }

  const rows = await sql`
    select u.user_id, u.nickname, r.game, r.mode, r.score, r.moves, r.seconds, r.created_at
    from ranking_records r
    join users u on u.id = r.user_pk
    where r.won = true and r.game = ${game} and r.mode = ${mode}
    order by r.score desc, r.seconds asc, r.moves asc nulls last, r.created_at asc
    limit ${limit}
  `;
  return sendJson(response, 200, { rankings: rows });
}

async function createRanking(request, response) {
  const body = await readJson(request);
  const record = normalizeRecord(body);

  if (!record) {
    return sendJson(response, 400, { error: "Invalid ranking record." });
  }

  const users = await sql`
    select id, user_id, nickname
    from users
    where user_id = ${record.userId}
  `;
  const user = users[0];
  if (!user) return sendJson(response, 404, { error: "User not found." });

  const rows = await sql`
    insert into ranking_records (user_pk, game, mode, score, moves, seconds, won)
    values (
      ${user.id},
      ${record.game},
      ${record.mode},
      ${record.score},
      ${record.moves},
      ${record.seconds},
      true
    )
    returning id, user_pk, game, mode, score, moves, seconds, created_at
  `;
  return sendJson(response, 201, {
    ranking: {
      ...rows[0],
      user_id: user.user_id,
      nickname: user.nickname,
    },
  });
}

function normalizeRecord(body) {
  const userId = String(body?.userId || "").trim().slice(0, 32);
  const game = String(body?.game || "");
  const mode = String(body?.mode || "");
  const score = Number(body?.score);
  const seconds = Number(body?.seconds);
  const moves = body?.moves === null || body?.moves === undefined ? null : Number(body.moves);

  if (!/^[A-Za-z0-9_]{4,32}$/.test(userId) || !validGames.has(game) || !validModes.has(mode)) return null;
  if (!Number.isInteger(score) || score < 0) return null;
  if (!Number.isInteger(seconds) || seconds < 0) return null;
  if (moves !== null && (!Number.isInteger(moves) || moves < 0)) return null;

  return { userId, game, mode, score, moves, seconds };
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 10_000) {
        reject(new Error("Request body too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}
