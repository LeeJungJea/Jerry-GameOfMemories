import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

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
type Sql = any;

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 500 });
  }

  const sql = neon(process.env.DATABASE_URL);
  const { searchParams } = request.nextUrl;
  const overall = searchParams.get("overall") === "true";
  const kind = searchParams.get("kind") || "score";
  const period = normalizePeriod(searchParams.get("period"));
  const limit = clamp(Number(searchParams.get("limit") || 10), 1, 100);
  const userPk = normalizeUserPk(searchParams.get("userPk"));
  const userId = normalizeUserId(searchParams.get("userId"));
  const rankUserPk = userPk ?? (userId ? await getPasswordUserPk(sql, userId) : null);
  const game = searchParams.get("game") || "";
  const mode = searchParams.get("mode") || "";

  if (kind === "activity") {
    if ((game && !validGames.has(game)) || (mode && !validModes.has(mode))) {
      return NextResponse.json({ error: "Valid game and mode are required." }, { status: 400 });
    }

    const rankings =
      game && mode
        ? await getModeActivityRankings(sql, period, game, mode, limit)
        : await getActivityRankings(sql, period, limit);
    const me = rankUserPk
      ? game && mode
        ? await getModeActivityUserRank(sql, period, rankUserPk, game, mode)
        : await getActivityUserRank(sql, period, rankUserPk)
      : null;
    return NextResponse.json({ rankings, me });
  }

  if (overall) {
    const rankings = await getOverallRankings(sql, period, limit);
    const me = rankUserPk ? await getOverallUserRank(sql, period, rankUserPk) : null;
    return NextResponse.json({ rankings, me });
  }

  if (!validGames.has(game) || !validModes.has(mode)) {
    return NextResponse.json({ error: "Valid game and mode are required." }, { status: 400 });
  }

  const rankings = await getModeRankings(sql, period, game, mode, limit);
  const me = rankUserPk ? await getModeUserRank(sql, period, rankUserPk, game, mode) : null;
  return NextResponse.json({ rankings, me });
}

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 500 });
  }

  const sql = neon(process.env.DATABASE_URL);
  const record = normalizeRecord(await request.json().catch(() => null));
  if (!record) return NextResponse.json({ error: "Invalid ranking record." }, { status: 400 });

  const users = record.userPk
    ? await sql`
        select u.id, u.nickname, a.login_id as user_id
        from users u
        left join auth_accounts a on a.user_pk = u.id and a.provider = 'password'
        where u.id = ${record.userPk}
      `
    : await sql`
        select u.id, u.nickname, a.login_id as user_id
        from auth_accounts a
        join users u on u.id = a.user_pk
        where a.provider = 'password' and a.login_id = ${record.userId}
      `;
  const user = users[0];
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const rows = await sql`
    insert into ranking_records (user_pk, game, mode, score, moves, seconds, won)
    values (${user.id}, ${record.game}, ${record.mode}, ${record.score}, ${record.moves}, ${record.seconds}, true)
    returning id, user_pk, game, mode, score, moves, seconds, created_at
  `;
  return NextResponse.json({ ranking: { ...rows[0], user_id: user.user_id, nickname: user.nickname } }, { status: 201 });
}

async function getOverallRankings(sql: Sql, period: string, limit: number) {
  return sql`
    with best_per_mode as (
      select distinct on (r.user_pk, r.game, r.mode)
        r.user_pk, a.login_id as user_id, u.nickname, r.game, r.mode, r.score, r.seconds, r.moves, r.created_at
      from ranking_records r
      join users u on u.id = r.user_pk
      left join auth_accounts a on a.user_pk = u.id and a.provider = 'password'
      where r.won = true and (${period} = 'all' or r.created_at >= ${periodStart(period)})
      order by r.user_pk, r.game, r.mode, r.score desc, r.seconds asc, r.moves asc nulls last, r.created_at asc
    ),
    totals as (
      select user_pk, user_id, nickname, sum(score)::int as total_score, count(*)::int as completed_modes,
        sum(seconds)::int as total_seconds, sum(coalesce(moves, 0))::int as total_moves
      from best_per_mode
      group by user_pk, user_id, nickname
    ),
    ranked as (
      select rank() over (order by total_score desc, completed_modes desc, total_seconds asc, total_moves asc)::int as rank,
        user_pk, user_id, nickname, total_score, completed_modes, total_seconds, total_moves
      from totals
    )
    select rank, user_id, nickname, total_score, completed_modes, total_seconds, total_moves
    from ranked
    order by rank asc
    limit ${limit}
  `;
}

async function getOverallUserRank(sql: Sql, period: string, userPk: number) {
  const rows = await sql`
    with best_per_mode as (
      select distinct on (r.user_pk, r.game, r.mode)
        r.user_pk, a.login_id as user_id, u.nickname, r.game, r.mode, r.score, r.seconds, r.moves, r.created_at
      from ranking_records r
      join users u on u.id = r.user_pk
      left join auth_accounts a on a.user_pk = u.id and a.provider = 'password'
      where r.won = true and (${period} = 'all' or r.created_at >= ${periodStart(period)})
      order by r.user_pk, r.game, r.mode, r.score desc, r.seconds asc, r.moves asc nulls last, r.created_at asc
    ),
    totals as (
      select user_pk, user_id, nickname, sum(score)::int as total_score, count(*)::int as completed_modes,
        sum(seconds)::int as total_seconds, sum(coalesce(moves, 0))::int as total_moves
      from best_per_mode
      group by user_pk, user_id, nickname
    ),
    ranked as (
      select rank() over (order by total_score desc, completed_modes desc, total_seconds asc, total_moves asc)::int as rank,
        user_pk, user_id, nickname, total_score, completed_modes, total_seconds, total_moves
      from totals
    )
    select rank, user_id, nickname, total_score, completed_modes, total_seconds, total_moves
    from ranked
    where user_pk = ${userPk}
  `;
  return rows[0] || null;
}

async function getModeRankings(sql: Sql, period: string, game: string, mode: string, limit: number) {
  return sql`
    with best_per_user as (
      select distinct on (r.user_pk)
        r.user_pk, a.login_id as user_id, u.nickname, r.game, r.mode, r.score, r.moves, r.seconds, r.created_at
      from ranking_records r
      join users u on u.id = r.user_pk
      left join auth_accounts a on a.user_pk = u.id and a.provider = 'password'
      where r.won = true and r.game = ${game} and r.mode = ${mode}
        and (${period} = 'all' or r.created_at >= ${periodStart(period)})
      order by r.user_pk, r.score desc, r.seconds asc, r.moves asc nulls last, r.created_at asc
    ),
    ranked as (
      select rank() over (order by score desc, seconds asc, moves asc nulls last, created_at asc)::int as rank,
        user_pk, user_id, nickname, game, mode, score, moves, seconds, created_at
      from best_per_user
    )
    select rank, user_id, nickname, game, mode, score, moves, seconds, created_at
    from ranked
    order by rank asc
    limit ${limit}
  `;
}

async function getModeUserRank(sql: Sql, period: string, userPk: number, game: string, mode: string) {
  const rows = await sql`
    with best_per_user as (
      select distinct on (r.user_pk)
        r.user_pk, a.login_id as user_id, u.nickname, r.game, r.mode, r.score, r.moves, r.seconds, r.created_at
      from ranking_records r
      join users u on u.id = r.user_pk
      left join auth_accounts a on a.user_pk = u.id and a.provider = 'password'
      where r.won = true and r.game = ${game} and r.mode = ${mode}
        and (${period} = 'all' or r.created_at >= ${periodStart(period)})
      order by r.user_pk, r.score desc, r.seconds asc, r.moves asc nulls last, r.created_at asc
    ),
    ranked as (
      select rank() over (order by score desc, seconds asc, moves asc nulls last, created_at asc)::int as rank,
        user_pk, user_id, nickname, game, mode, score, moves, seconds, created_at
      from best_per_user
    )
    select rank, user_id, nickname, game, mode, score, moves, seconds, created_at
    from ranked
    where user_pk = ${userPk}
  `;
  return rows[0] || null;
}

async function getActivityRankings(sql: Sql, period: string, limit: number) {
  return sql`
    with totals as (
      select
        r.user_pk,
        a.login_id as user_id,
        u.nickname,
        count(*)::int as clears,
        sum(r.score)::int as total_score,
        sum(r.seconds)::int as total_seconds
      from ranking_records r
      join users u on u.id = r.user_pk
      left join auth_accounts a on a.user_pk = u.id and a.provider = 'password'
      where r.won = true and (${period} = 'all' or r.created_at >= ${periodStart(period)})
      group by r.user_pk, a.login_id, u.nickname
    ),
    ranked as (
      select
        rank() over (order by clears desc, total_score desc, total_seconds asc)::int as rank,
        user_pk,
        user_id,
        nickname,
        clears,
        total_score,
        total_seconds
      from totals
    )
    select rank, user_id, nickname, clears, total_score, total_seconds
    from ranked
    order by rank asc
    limit ${limit}
  `;
}

async function getActivityUserRank(sql: Sql, period: string, userPk: number) {
  const rows = await sql`
    with totals as (
      select
        r.user_pk,
        a.login_id as user_id,
        u.nickname,
        count(*)::int as clears,
        sum(r.score)::int as total_score,
        sum(r.seconds)::int as total_seconds
      from ranking_records r
      join users u on u.id = r.user_pk
      left join auth_accounts a on a.user_pk = u.id and a.provider = 'password'
      where r.won = true and (${period} = 'all' or r.created_at >= ${periodStart(period)})
      group by r.user_pk, a.login_id, u.nickname
    ),
    ranked as (
      select
        rank() over (order by clears desc, total_score desc, total_seconds asc)::int as rank,
        user_pk,
        user_id,
        nickname,
        clears,
        total_score,
        total_seconds
      from totals
    )
    select rank, user_id, nickname, clears, total_score, total_seconds
    from ranked
    where user_pk = ${userPk}
  `;
  return rows[0] || null;
}

async function getModeActivityRankings(sql: Sql, period: string, game: string, mode: string, limit: number) {
  return sql`
    with totals as (
      select
        r.user_pk,
        a.login_id as user_id,
        u.nickname,
        count(*)::int as clears,
        sum(r.score)::int as total_score,
        sum(r.seconds)::int as total_seconds
      from ranking_records r
      join users u on u.id = r.user_pk
      left join auth_accounts a on a.user_pk = u.id and a.provider = 'password'
      where r.won = true and r.game = ${game} and r.mode = ${mode}
        and (${period} = 'all' or r.created_at >= ${periodStart(period)})
      group by r.user_pk, a.login_id, u.nickname
    ),
    ranked as (
      select
        rank() over (order by clears desc, total_score desc, total_seconds asc)::int as rank,
        user_pk,
        user_id,
        nickname,
        clears,
        total_score,
        total_seconds
      from totals
    )
    select rank, user_id, nickname, clears, total_score, total_seconds
    from ranked
    order by rank asc
    limit ${limit}
  `;
}

async function getModeActivityUserRank(sql: Sql, period: string, userPk: number, game: string, mode: string) {
  const rows = await sql`
    with totals as (
      select
        r.user_pk,
        a.login_id as user_id,
        u.nickname,
        count(*)::int as clears,
        sum(r.score)::int as total_score,
        sum(r.seconds)::int as total_seconds
      from ranking_records r
      join users u on u.id = r.user_pk
      left join auth_accounts a on a.user_pk = u.id and a.provider = 'password'
      where r.won = true and r.game = ${game} and r.mode = ${mode}
        and (${period} = 'all' or r.created_at >= ${periodStart(period)})
      group by r.user_pk, a.login_id, u.nickname
    ),
    ranked as (
      select
        rank() over (order by clears desc, total_score desc, total_seconds asc)::int as rank,
        user_pk,
        user_id,
        nickname,
        clears,
        total_score,
        total_seconds
      from totals
    )
    select rank, user_id, nickname, clears, total_score, total_seconds
    from ranked
    where user_pk = ${userPk}
  `;
  return rows[0] || null;
}

function normalizeRecord(body: unknown) {
  const data = body as Record<string, unknown> | null;
  const userId = String(data?.userId || "").trim().slice(0, 32);
  const userPk = normalizeUserPk(data?.userPk);
  const game = String(data?.game || "");
  const mode = String(data?.mode || "");
  const score = Number(data?.score);
  const seconds = Number(data?.seconds);
  const moves = data?.moves === null || data?.moves === undefined ? null : Number(data.moves);

  if (!userPk && !normalizeUserId(userId)) return null;
  if (!validGames.has(game) || !validModes.has(mode)) return null;
  if (!Number.isInteger(score) || score < 0) return null;
  if (!Number.isInteger(seconds) || seconds < 0) return null;
  if (moves !== null && (!Number.isInteger(moves) || moves < 0)) return null;
  return { userId, userPk, game, mode, score, moves, seconds };
}

function normalizeUserId(value: unknown) {
  const userId = String(value || "").trim().slice(0, 32);
  return /^[A-Za-z0-9_]{4,32}$/.test(userId) ? userId : null;
}

function normalizeUserPk(value: unknown) {
  const userPk = Number(value);
  return Number.isInteger(userPk) && userPk > 0 ? userPk : null;
}

function normalizePeriod(value: unknown) {
  const period = String(value || "weekly");
  return ["daily", "weekly", "monthly", "all"].includes(period) ? period : "weekly";
}

function periodStart(period: string) {
  const now = new Date();
  if (period === "daily") {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }
  if (period === "monthly") {
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }
  if (period === "all") return "1970-01-01T00:00:00.000Z";
  const day = now.getDay();
  const daysSinceMonday = (day + 6) % 7;
  now.setDate(now.getDate() - daysSinceMonday);
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

async function getPasswordUserPk(sql: Sql, userId: string) {
  const rows = await sql`
    select user_pk
    from auth_accounts
    where provider = 'password' and login_id = ${userId}
  `;
  return rows[0]?.user_pk ? Number(rows[0].user_pk) : null;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
