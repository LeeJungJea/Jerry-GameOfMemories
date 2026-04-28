import crypto from "crypto";
import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

const userIdPattern = /^[A-Za-z0-9_]{4,32}$/;

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const userId = String(body?.userId || "").trim();
  const password = String(body?.password || "");

  if (!userIdPattern.test(userId) || password.length < 8) {
    return NextResponse.json({ error: "Invalid login data." }, { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    select u.id, u.nickname, u.email, u.image_url, u.created_at, a.login_id, a.password_hash
    from auth_accounts a
    join users u on u.id = a.user_pk
    where a.provider = 'password' and a.login_id = ${userId}
  `;
  const user = rows[0];
  if (!user || !(await verifyPassword(password, String(user.password_hash)))) {
    return NextResponse.json({ error: "Invalid user ID or password." }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      user_id: user.login_id,
      nickname: user.nickname,
      email: user.email,
      image_url: user.image_url,
      provider: "password",
      created_at: user.created_at,
    },
  });
}

function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterations, salt, hash] = storedHash.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterations || !salt || !hash) return false;

  return new Promise<boolean>((resolve, reject) => {
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
