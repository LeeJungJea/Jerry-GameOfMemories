import crypto from "crypto";
import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

const userIdPattern = /^[A-Za-z0-9_]{4,32}$/;

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 500 });
  }

  const user = normalizeUser(await request.json().catch(() => null));
  if (!user) return NextResponse.json({ error: "Invalid user data." }, { status: 400 });

  try {
    const sql = neon(process.env.DATABASE_URL);
    const passwordHash = await hashPassword(user.password);
    const users = await sql`
      insert into users (nickname)
      values (${user.nickname})
      returning id, nickname, email, image_url, created_at
    `;
    const createdUser = users[0];

    await sql`
      insert into auth_accounts (user_pk, provider, login_id, password_hash)
      values (${createdUser.id}, 'password', ${user.userId}, ${passwordHash})
    `;

    return NextResponse.json(
      {
        user: {
          ...createdUser,
          user_id: user.userId,
          provider: "password",
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "User ID or nickname already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Register request failed." }, { status: 500 });
  }
}

function normalizeUser(body: unknown) {
  const data = body as Record<string, unknown> | null;
  const userId = String(data?.userId || "").trim();
  const nickname = String(data?.nickname || "").trim();
  const password = String(data?.password || "");

  if (!userIdPattern.test(userId)) return null;
  if (nickname.length < 2 || nickname.length > 32) return null;
  if (password.length < 8 || password.length > 128) return null;
  return { userId, nickname, password };
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise<string>((resolve, reject) => {
    crypto.pbkdf2(password, salt, 210000, 32, "sha256", (error, key) => {
      if (error) reject(error);
      else resolve(`pbkdf2_sha256$210000$${salt}$${key.toString("hex")}`);
    });
  });
}
