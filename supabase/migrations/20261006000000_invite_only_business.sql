-- ============================================================================
-- Bookly — invite-only business accounts (security handoff 01, 2026-10-06)
-- ============================================================================
-- Before this migration, three paths let anyone become a business without an
-- invite, all reachable straight through the public API (no app involved):
--   1. sign up with user_metadata {"role":"business_owner"} — the
--      handle_new_user trigger trusted it;
--   2. a customer updates their own profiles.role ("profiles: update own" lets
--      a user write every column of their own row);
--   3. any signed-in user inserts a businesses row (the policy checked only
--      owner_id = auth.uid(), never the role).
-- Customer self-sign-up stays open. Only Bookly staff (SQL, Studio, or the
-- service-role key) can make or promote a business owner.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The role comes from app_metadata, which only the server can set
--    (admin API with the service key, or SQL). user_metadata is client-writable
--    and is no longer trusted for the role.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  granted_role text := new.raw_app_meta_data ->> 'role';
begin
  insert into public.profiles (id, role, full_name, phone, email, avatar_url)
  values (
    new.id,
    case when granted_role = 'business_owner' then 'business_owner'::public.user_role
         else 'customer'::public.user_role end,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    ),
    new.raw_user_meta_data ->> 'phone',
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. A signed-in user can never change their own role. Requests with no user
--    (SQL as postgres, the service-role key, seed.sql) still can — that is how
--    staff promote an invited shop.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and (select auth.uid()) is not null then
    raise exception 'Only Bookly staff can change an account type'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- The self-insert repair path may only ever create a customer profile.
drop policy if exists "profiles: insert self" on public.profiles;
create policy "profiles: insert self"
  on public.profiles for insert
  with check (id = (select auth.uid()) and role = 'customer');

-- ---------------------------------------------------------------------------
-- 3. Only a business owner can create a business.
-- ---------------------------------------------------------------------------
create or replace function public.is_business_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'business_owner'
  );
$$;

revoke all on function public.is_business_owner() from public;
grant execute on function public.is_business_owner() to authenticated;

drop policy if exists "businesses: owner inserts own" on public.businesses;
create policy "businesses: owner inserts own"
  on public.businesses for insert
  to authenticated
  with check (owner_id = (select auth.uid()) and public.is_business_owner());
