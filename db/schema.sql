create table if not exists users (
  id bigserial primary key,
  user_id varchar(32) not null unique,
  nickname varchar(32) not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_user_id_format check (user_id ~ '^[A-Za-z0-9_]{4,32}$'),
  constraint users_nickname_format check (char_length(trim(nickname)) between 2 and 32)
);

create table if not exists ranking_records (
  id bigserial primary key,
  user_pk bigint not null references users(id) on delete cascade,
  game varchar(32) not null,
  mode varchar(32) not null,
  score integer not null check (score >= 0),
  moves integer check (moves is null or moves >= 0),
  seconds integer not null check (seconds >= 0),
  won boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists ranking_records_mode_score_idx
  on ranking_records (game, mode, score desc, seconds asc, moves asc, created_at asc);

create index if not exists ranking_records_user_idx
  on ranking_records (user_pk, game, mode, score desc);
