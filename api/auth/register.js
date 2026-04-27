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
    const user = normalizeUser(body);
    if (!user) return sendJson(response, 400, { error: "Invalid user data." });

    const passwordHash = await hashPassword(user.password);
    const rows = await sql`
      insert into users (user_id, nickname, password_hash)
      values (${user.userId}, ${user.nickname}, ${passwordHash})
      returning id, user_id, nickname, created_at
    `;

    return sendJson(response, 201, { user: rows[0] });
  } catch (error) {
    if (error?.code === "23505") {
      return sendJson(response, 409, { error: "User ID or nickname already exists." });
    }
    return sendJson(response, 500, { error: "Register request failed." });
  }
};

function normalizeUser(body) {
  const userId = String(body?.userId || "").trim();
  const nickname = String(body?.nickname || "").trim();
  const password = String(body?.password || "");

  if (!userIdPattern.test(userId)) return null;
  if (nickname.length < 2 || nickname.length > 32) return null;
  if (password.length < 8 || password.length > 128) return null;

  return { userId, nickname, password };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 210000, 32, "sha256", (error, key) => {
      if (error) reject(error);
      else resolve(`pbkdf2_sha256$210000$${salt}$${key.toString("hex")}`);
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
