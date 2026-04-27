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

The schema stores login identity and ranking display separately:

- `users.user_id`: login ID, unique
- `users.password_hash`: hashed password only, never a plain password
- `users.nickname`: display name shown on rankings, unique
- `ranking_records.user_pk`: linked user record

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
