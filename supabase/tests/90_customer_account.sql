\set ON_ERROR_STOP on

-- ===========================================================================
-- Customer account (migration 20261104000000_customer_account.sql;
-- tatnat-accounts-billing handoff 07, test C8). Same fixture users as the
-- earlier files:
--   33333333...  Ann (customer)          44444444...  Ben (customer)
-- Covers: notification_prefs defaults and self-only RLS, the database stamping
-- the marketing consent time, profile isolation including pending_email, the
-- pending-email clear on confirmation, and the photo bucket's owner-only rule
-- (public.is_own_avatar_path, which the storage policies call).
-- ===========================================================================

reset role;

-- Remember what this file changes on Ann so it can put it back.
create temp table orig90 as
  select p.phone, p.email as profile_email, u.email as auth_email
    from public.profiles p left join auth.users u on u.id = p.id
   where p.id = '33333333-3333-3333-3333-333333333333';
grant select on orig90 to authenticated;

create or replace function test_count_as90(uid uuid, sql text)
returns bigint language plpgsql security invoker as $$
declare n bigint;
begin
  perform set_config('test.uid', coalesce(uid::text, ''), true);
  execute sql into n;
  return n;
end $$;

-- Rows changed by a statement run as `uid` (0 when RLS hides every row).
create or replace function test_rows_as90(uid uuid, sql text)
returns bigint language plpgsql security invoker as $$
declare n bigint;
begin
  perform set_config('test.uid', coalesce(uid::text, ''), true);
  execute sql;
  get diagnostics n = row_count;
  return n;
end $$;

-- The error text a statement raises as `uid`, or null if it succeeds.
create or replace function test_error_as90(uid uuid, sql text)
returns text language plpgsql security invoker as $$
begin
  perform set_config('test.uid', coalesce(uid::text, ''), true);
  execute sql;
  return null;
exception when others then
  return sqlerrm;
end $$;

create or replace function test_bool_as90(uid uuid, sql text)
returns boolean language plpgsql security invoker as $$
declare b boolean;
begin
  perform set_config('test.uid', coalesce(uid::text, ''), true);
  execute sql into b;
  return b;
end $$;

grant execute on function
  test_count_as90(uuid, text), test_rows_as90(uuid, text),
  test_error_as90(uuid, text), test_bool_as90(uuid, text)
  to anon, authenticated;

set role authenticated;

-- --- defaults ----------------------------------------------------------------
select test_assert(
  test_rows_as90('33333333-3333-3333-3333-333333333333',
    $q$insert into public.notification_prefs (user_id) values ('33333333-3333-3333-3333-333333333333')$q$) = 1,
  'Ann can create her own prefs row');

select test_assert(
  -- Read as Ann (the uid is per statement), not as a bare role that RLS shows nothing.
  test_bool_as90('33333333-3333-3333-3333-333333333333', $q$
    select booking_confirmations and reminders and not marketing
           and marketing_consented_at is null and marketing_withdrawn_at is null
      from public.notification_prefs where user_id = '33333333-3333-3333-3333-333333333333'$q$),
  'defaults: confirmations on, reminders on, marketing OFF and no consent time');

-- --- inserting with marketing on stamps the time, whatever the client sent ----
select test_assert(
  test_rows_as90('44444444-4444-4444-4444-444444444444',
    $q$insert into public.notification_prefs (user_id, marketing, marketing_consented_at, marketing_consent_version)
       values ('44444444-4444-4444-4444-444444444444', true, '2001-01-01T00:00:00Z', 'marketing-test')$q$) = 1,
  'Ben can create his prefs with marketing on');
select test_assert(
  test_bool_as90('44444444-4444-4444-4444-444444444444',
    $q$select marketing and marketing_consented_at > now() - interval '1 minute'
         from public.notification_prefs where user_id = '44444444-4444-4444-4444-444444444444'$q$),
  'the database stamps the consent time itself (a forged 2001 time is ignored)');

-- --- turning marketing on / off records consent and withdrawal ----------------
select test_assert(
  test_rows_as90('33333333-3333-3333-3333-333333333333',
    $q$update public.notification_prefs set marketing = true, marketing_consent_version = 'marketing-test'
       where user_id = '33333333-3333-3333-3333-333333333333'$q$) = 1,
  'Ann turns marketing on');
select test_assert(
  test_bool_as90('33333333-3333-3333-3333-333333333333', $q$select marketing and marketing_consented_at is not null and marketing_withdrawn_at is null
     from public.notification_prefs where user_id = '33333333-3333-3333-3333-333333333333'$q$),
  'marketing on: consent time set, no withdrawal time');

select test_assert(
  test_rows_as90('33333333-3333-3333-3333-333333333333',
    $q$update public.notification_prefs set reminders = false
       where user_id = '33333333-3333-3333-3333-333333333333'$q$) = 1,
  'Ann turns reminders off (a different switch)');
select test_assert(
  test_bool_as90('33333333-3333-3333-3333-333333333333', $q$select marketing and not reminders and marketing_withdrawn_at is null
     from public.notification_prefs where user_id = '33333333-3333-3333-3333-333333333333'$q$),
  'switching reminders does not touch the marketing consent');

select test_assert(
  test_rows_as90('33333333-3333-3333-3333-333333333333',
    $q$update public.notification_prefs set marketing = false, marketing_consented_at = null
       where user_id = '33333333-3333-3333-3333-333333333333'$q$) = 1,
  'Ann withdraws marketing, trying to wipe the consent time too');
select test_assert(
  test_bool_as90('33333333-3333-3333-3333-333333333333', $q$select not marketing and marketing_consented_at is not null and marketing_withdrawn_at is not null
     from public.notification_prefs where user_id = '33333333-3333-3333-3333-333333333333'$q$),
  'withdrawal is recorded and the earlier consent time is kept for the audit trail');

-- --- self-only RLS on notification_prefs --------------------------------------
select test_assert(
  test_count_as90('33333333-3333-3333-3333-333333333333', 'select count(*) from public.notification_prefs') = 1,
  'Ann sees exactly her own prefs');
select test_assert(
  test_count_as90('44444444-4444-4444-4444-444444444444', 'select count(*) from public.notification_prefs') = 1,
  'Ben sees exactly his own prefs, not Ann''s');
select test_assert(
  test_count_as90('11111111-1111-1111-1111-111111111111', 'select count(*) from public.notification_prefs') = 0,
  'a shop owner sees no customer prefs');
select test_assert(
  test_count_as90(null, 'select count(*) from public.notification_prefs') = 0,
  'an anonymous visitor sees no prefs');

select test_assert(
  test_rows_as90('44444444-4444-4444-4444-444444444444',
    $q$update public.notification_prefs set marketing = true, reminders = false
       where user_id = '33333333-3333-3333-3333-333333333333'$q$) = 0,
  'Ben cannot update Ann''s prefs (0 rows)');
select test_assert(
  test_error_as90('44444444-4444-4444-4444-444444444444',
    $q$insert into public.notification_prefs (user_id) values ('33333333-3333-3333-3333-333333333333')$q$) is not null,
  'Ben cannot create a prefs row in Ann''s name');
select test_assert(
  test_rows_as90('44444444-4444-4444-4444-444444444444',
    $q$delete from public.notification_prefs where user_id = '33333333-3333-3333-3333-333333333333'$q$) = 0,
  'Ben cannot delete Ann''s prefs');
select test_assert(
  test_bool_as90('33333333-3333-3333-3333-333333333333', $q$
    select reminders = false and marketing = false from public.notification_prefs
     where user_id = '33333333-3333-3333-3333-333333333333'$q$),
  'Ann''s prefs are untouched by Ben''s attempts');

-- --- profile isolation (name, phone, photo, pending email) -------------------
select test_assert(
  test_rows_as90('33333333-3333-3333-3333-333333333333',
    $q$update public.profiles set pending_email = 'ann.new@example.com', phone = '0811110000'
       where id = '33333333-3333-3333-3333-333333333333'$q$) = 1,
  'Ann sets her own pending email and phone');
select test_assert(
  test_rows_as90('44444444-4444-4444-4444-444444444444',
    $q$update public.profiles set pending_email = 'evil@example.com', full_name = 'Hacked', avatar_url = 'x'
       where id = '33333333-3333-3333-3333-333333333333'$q$) = 0,
  'Ben cannot edit Ann''s profile (name, photo, pending email)');
select test_assert(
  test_count_as90('44444444-4444-4444-4444-444444444444',
    $q$select count(*) from public.profiles where id = '33333333-3333-3333-3333-333333333333'$q$) = 0,
  'Ben cannot read Ann''s profile, so not her pending email either');
select test_assert(
  test_count_as90('11111111-1111-1111-1111-111111111111',
    $q$select count(*) from public.profiles where id = '33333333-3333-3333-3333-333333333333'$q$) = 0,
  'a shop owner cannot read a customer profile');
select test_assert(
  test_error_as90('33333333-3333-3333-3333-333333333333',
    $q$update public.profiles set pending_email = 'x' where id = '33333333-3333-3333-3333-333333333333'$q$) is not null,
  'a pending email that cannot be an address (too short) is refused by the constraint');

-- --- confirmation moves the email and clears the pending value ---------------
reset role;
update auth.users set email = 'ann.new@example.com' where id = '33333333-3333-3333-3333-333333333333';
select test_assert(
  (select email = 'ann.new@example.com' and pending_email is null
     from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
  'confirming the new address moves profiles.email and clears pending_email');

-- --- photo bucket: owner of the folder only ----------------------------------
select test_assert(
  test_bool_as90('33333333-3333-3333-3333-333333333333',
    $q$select public.is_own_avatar_path('33333333-3333-3333-3333-333333333333/photo-1.jpg')$q$),
  'Ann owns files in her own folder');
select test_assert(
  not test_bool_as90('44444444-4444-4444-4444-444444444444',
    $q$select public.is_own_avatar_path('33333333-3333-3333-3333-333333333333/photo-1.jpg')$q$),
  'Ben does not own files in Ann''s folder');
select test_assert(
  not test_bool_as90(null,
    $q$select public.is_own_avatar_path('33333333-3333-3333-3333-333333333333/photo-1.jpg')$q$),
  'an anonymous visitor owns nothing');
select test_assert(
  not test_bool_as90('33333333-3333-3333-3333-333333333333',
    $q$select public.is_own_avatar_path('photo-1.jpg')$q$)
  and not test_bool_as90('33333333-3333-3333-3333-333333333333',
    $q$select public.is_own_avatar_path('33333333-3333-3333-3333-333333333333/sub/photo.jpg')$q$)
  and not test_bool_as90('33333333-3333-3333-3333-333333333333',
    $q$select public.is_own_avatar_path('33333333-3333-3333-3333-333333333333/')$q$),
  'a file outside the user folder, in a sub-folder, or with no name is not allowed');

-- Where Supabase Storage exists, the bucket itself must be private and limited.
-- (A DO block with dynamic SQL: a plain CASE would still need storage.buckets to exist at parse time.)
do $$
declare ok boolean := true;
begin
  if to_regclass('storage.buckets') is not null then
    execute $q$select not public and file_size_limit = 2097152
                      and allowed_mime_types @> array['image/jpeg','image/png','image/webp']
                 from storage.buckets where id = 'avatars'$q$ into ok;
  end if;
  if ok is distinct from true then
    raise exception 'FAIL  avatars bucket is private, 2 MB, jpg/png/webp only';
  end if;
end $$;
select test_assert(true, 'avatars bucket is private, 2 MB, jpg/png/webp only (skipped without a storage schema)');

-- --- F2: account deletion clears pending_email, the prefs row and queues the photo file
update public.profiles
   set pending_email = 'pending-ben@example.com', avatar_url = '44444444-4444-4444-4444-444444444444/photo-1.jpg'
 where id = '44444444-4444-4444-4444-444444444444';
insert into public.notification_prefs (user_id) values ('44444444-4444-4444-4444-444444444444')
  on conflict (user_id) do nothing;
-- (Ben may already have a completed request from 50_pdpa_isolation; one row per user and status.)
delete from public.deletion_requests where user_id = '44444444-4444-4444-4444-444444444444' and status = 'completed';
insert into public.deletion_requests (user_id, requested_at)
values ('44444444-4444-4444-4444-444444444444', now() - interval '45 days');

set role service_role;
select public.pdpa_process_deletion_requests(30);
reset role;

select test_assert(
  (select pending_email is null and avatar_url is null from public.profiles
    where id = '44444444-4444-4444-4444-444444444444'),
  'deletion clears pending_email and the photo link');
select test_assert(
  not exists (select 1 from public.notification_prefs where user_id = '44444444-4444-4444-4444-444444444444'),
  'deletion removes the notification_prefs row');
select test_assert(
  exists (select 1 from public.avatar_cleanup_queue
           where path = '44444444-4444-4444-4444-444444444444/photo-1.jpg'),
  'deletion queues the stored photo file for removal');
delete from public.avatar_cleanup_queue where path like '44444444-4444-4444-4444-444444444444/%';
delete from public.deletion_requests where user_id = '44444444-4444-4444-4444-444444444444';

-- --- clean up so later files see an unchanged database -----------------------
delete from public.notification_prefs
 where user_id in ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444');
reset role;
update auth.users set email = (select auth_email from orig90) where id = '33333333-3333-3333-3333-333333333333';
update public.profiles
   set pending_email = null,
       phone = (select phone from orig90),
       email = (select profile_email from orig90)
 where id = '33333333-3333-3333-3333-333333333333';
