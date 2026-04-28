create table if not exists users (
  id bigserial primary key,
  nickname varchar(32) not null unique,
  email varchar(255),
  image_url text,
  user_id varchar(32) unique,
  password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_user_id_format check (user_id is null or user_id ~ '^[A-Za-z0-9_]{4,32}$'),
  constraint users_nickname_format check (char_length(trim(nickname)) between 2 and 32)
);

alter table users
  add column if not exists email varchar(255);

alter table users
  add column if not exists image_url text;

alter table users
  add column if not exists user_id varchar(32);

alter table users
  add column if not exists password_hash text;

alter table users
  alter column user_id drop not null;

alter table users
  alter column password_hash drop not null;

create table if not exists auth_accounts (
  id bigserial primary key,
  user_pk bigint not null references users(id) on delete cascade,
  provider varchar(32) not null,
  provider_account_id varchar(255),
  login_id varchar(32),
  email varchar(255),
  password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auth_accounts_provider_check check (provider in ('password', 'google', 'kakao')),
  constraint auth_accounts_login_id_format check (login_id is null or login_id ~ '^[A-Za-z0-9_]{4,32}$'),
  constraint auth_accounts_identity_check check (
    (provider = 'password' and login_id is not null and password_hash is not null) or
    (provider in ('google', 'kakao') and provider_account_id is not null)
  )
);

create unique index if not exists auth_accounts_provider_account_idx
  on auth_accounts (provider, provider_account_id)
  where provider_account_id is not null;

create unique index if not exists auth_accounts_provider_login_idx
  on auth_accounts (provider, login_id)
  where login_id is not null;

insert into auth_accounts (user_pk, provider, login_id, password_hash)
select id, 'password', user_id, password_hash
from users
where user_id is not null
  and password_hash is not null
on conflict do nothing;

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
