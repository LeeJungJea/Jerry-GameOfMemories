const crypto = require("crypto");
const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);
const userIdPattern = /^[A-Za-z0-9_]{4,32}$/;

module.exports = async function handler(request, response) {
  try {
    if (!process.env.DATABASE_URL) {
      return sendJson(response, 500, { error: "DATABASE_URL is not configured." });
    }
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      return sendJson(response, 405, { error: "Method not allowed." });
    }

    const body = await readJson(request);
    const userId = String(body?.userId || "").trim();
    const password = String(body?.password || "");

    if (!userIdPattern.test(userId) || password.length < 8) {
      return sendJson(response, 400, { error: "Invalid login data." });
    }

    const rows = await sql`
      select id, user_id, nickname, password_hash, created_at
      from users
      where user_id = ${userId}
    `;
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return sendJson(response, 401, { error: "Invalid user ID or password." });
    }

    return sendJson(response, 200, {
      user: {
        id: user.id,
        user_id: user.user_id,
        nickname: user.nickname,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    return sendJson(response, 500, { error: "Login request failed." });
  }
};

function verifyPassword(password, storedHash) {
  const [algorithm, iterations, salt, hash] = String(storedHash || "").split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterations || !salt || !hash) return false;

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, Number(iterations), 32, "sha256", (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      const expected = Buffer.from(hash, "hex");
      resolve(expected.length === key.length && crypto.timingSafeEqual(expected, key));
    });
  });
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

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}
