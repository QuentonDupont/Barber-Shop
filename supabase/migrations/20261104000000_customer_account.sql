-- Customer account (tatnat-accounts-billing, customer stream; feasibility §6,
-- legal-review D).
--
--   * profiles.pending_email   — a new sign-in email waiting for its confirm
--     link. `profiles.email` (mirror of auth.users.email) stays the current one
--     until the user confirms; the existing on_auth_user_email_changed trigger
--     then moves it and (below) clears the pending value.
--   * notification_prefs       — booking confirmations and reminders (service
--     messages, default on) and marketing (separate opt-in, default off) with
--     the consent time. Self-only RLS. A trigger stamps the consent times so a
--     forged client cannot back-date a consent.
--   * storage bucket "avatars" — private, jpg/png/webp, 2 MB, owner-only by
--     folder name "<user id>/...". The policy logic lives in
--     public.is_own_avatar_path() so it is testable without a storage schema.

-- ---------------------------------------------------------------------------
-- Pending email
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists pending_email text;
alter table public.profiles drop constraint if exists profiles_pending_email_len;
alter table public.profiles add constraint profiles_pending_email_len
  check (pending_email is null or char_length(pending_email) between 3 and 254);

-- Same as before, plus: once the confirmed address arrives, the pending value
-- is no longer pending.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set email = new.email,
         pending_email = case when lower(pending_email) = lower(new.email) then null else pending_email end
   where id = new.id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- notification_prefs
-- ---------------------------------------------------------------------------
create table if not exists public.notification_prefs (
  user_id                   uuid primary key references public.profiles (id) on delete cascade,
  booking_confirmations     boolean not null default true,
  reminders                 boolean not null default true,
  marketing                 boolean not null default false,
  marketing_consented_at    timestamptz,
  marketing_withdrawn_at    timestamptz,
  marketing_consent_version text,
  updated_at                timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

-- Private to the user. No policy for anyone else (not even a shop owner), so
-- RLS denies by default. No delete policy: the row goes with the account.
create policy notification_prefs_self_select on public.notification_prefs
  for select using (user_id = (select auth.uid()));
create policy notification_prefs_self_insert on public.notification_prefs
  for insert with check (user_id = (select auth.uid()));
create policy notification_prefs_self_update on public.notification_prefs
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- The database, not the client, decides the consent times.
create or replace function public.notification_prefs_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.marketing_consented_at := null;
    new.marketing_withdrawn_at := null;
    if new.marketing then
      new.marketing_consented_at := now();
    else
      new.marketing_consent_version := null;
    end if;
  else
    -- Never let a client edit the times directly.
    new.marketing_consented_at := old.marketing_consented_at;
    new.marketing_withdrawn_at := old.marketing_withdrawn_at;
    if new.marketing and not old.marketing then
      new.marketing_consented_at := now();
      new.marketing_withdrawn_at := null;
    elsif old.marketing and not new.marketing then
      new.marketing_withdrawn_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists notification_prefs_stamp on public.notification_prefs;
create trigger notification_prefs_stamp
  before insert or update on public.notification_prefs
  for each row execute function public.notification_prefs_stamp();

-- ---------------------------------------------------------------------------
-- Photo bucket: owner of the folder only
-- ---------------------------------------------------------------------------
create or replace function public.is_own_avatar_path(object_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is not null
     and object_name like auth.uid()::text || '/_%'
     and strpos(substr(object_name, char_length(auth.uid()::text) + 2), '/') = 0;
$$;

-- Supabase has the storage schema; the plain-Postgres test shim does not, so
-- this part only runs where it exists.
do $$
begin
  if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update
      set public = false,
          file_size_limit = 2097152,
          allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

    drop policy if exists avatars_owner_select on storage.objects;
    drop policy if exists avatars_owner_insert on storage.objects;
    drop policy if exists avatars_owner_update on storage.objects;
    drop policy if exists avatars_owner_delete on storage.objects;

    create policy avatars_owner_select on storage.objects for select to authenticated
      using (bucket_id = 'avatars' and public.is_own_avatar_path(name));
    create policy avatars_owner_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and public.is_own_avatar_path(name));
    create policy avatars_owner_update on storage.objects for update to authenticated
      using (bucket_id = 'avatars' and public.is_own_avatar_path(name))
      with check (bucket_id = 'avatars' and public.is_own_avatar_path(name));
    create policy avatars_owner_delete on storage.objects for delete to authenticated
      using (bucket_id = 'avatars' and public.is_own_avatar_path(name));
  end if;
end
$$;
