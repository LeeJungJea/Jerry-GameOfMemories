# Vercel DB Setup

This project is prepared for a Vercel Marketplace Postgres database.

## 1. Create the database

1. Open the Vercel project dashboard.
2. Go to Storage or Marketplace.
3. Add a Postgres provider such as Neon.
4. Connect it to this Vercel project.
5. Confirm that `DATABASE_URL` is added to the project environment variables.

## 2. Create the ranking table

Run the SQL in `db/schema.sql` against the Postgres database.

The schema stores profile identity and login methods separately:

- `users.nickname`: display name shown on rankings, unique
- `users.email`: optional profile email, useful for future OAuth
- `users.image_url`: optional profile image, useful for future OAuth
- `auth_accounts.provider`: `password`, `google`, or `kakao`
- `auth_accounts.login_id`: local password login ID
- `auth_accounts.provider_account_id`: Google/Kakao account ID
- `auth_accounts.password_hash`: hashed password for local password login only
- `ranking_records.user_pk`: linked user profile record

This lets local password login work now while leaving room to attach Google or Kakao login to the same `users` profile later. Rankings always display `users.nickname`.

## 3. API endpoints

Register:

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "userId": "jerry",
  "nickname": "Jerry",
  "password": "password123"
}
```

Login:

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "userId": "jerry",
  "password": "password123"
}
```

Submit a completed game record:

```http
POST /api/rankings
Content-Type: application/json
```

```json
{
  "userId": "jerry",
  "game": "klondike",
  "mode": "klondike-draw-1",
  "score": 9312,
  "moves": 86,
  "seconds": 240
}
```

Get a mode ranking:

```http
GET /api/rankings?game=klondike&mode=klondike-draw-1&limit=10
```

Get the overall ranking:

```http
GET /api/rankings?overall=true&limit=10
```
