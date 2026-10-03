-- Minimal stand-in for the parts of a Supabase project the migrations depend
-- on. Only used to validate the migrations locally; the real platform provides
-- all of this.
create extension if not exists pgcrypto;
create schema if not exists auth;

-- Columns mirror the subset of GoTrue's auth.users that seed.sql writes, so
-- the seed can be verified here too.
create table if not exists auth.users (
  id                          uuid primary key default gen_random_uuid(),
  instance_id                 uuid,
  aud                         text,
  role                        text,
  email                       text unique,
  encrypted_password          text,
  email_confirmed_at          timestamptz,
  raw_app_meta_data           jsonb not null default '{}'::jsonb,
  raw_user_meta_data          jsonb not null default '{}'::jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  confirmation_token          text,
  recovery_token              text,
  email_change                text,
  email_change_token_new      text,
  email_change_token_current  text,
  phone_change                text,
  phone_change_token          text,
  reauthentication_token      text,
  is_sso_user                 boolean not null default false
);

create table if not exists auth.identities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  provider_id      text not null,
  provider         text not null,
  identity_data    jsonb not null,
  last_sign_in_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (provider_id, provider)
);

-- Supabase derives auth.uid() from the request JWT. Here it reads a GUC so a
-- test can "become" a user with `set local`.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('test.uid', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
