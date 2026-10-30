-- ============================================================================
-- TatNat — helper functions and auth wiring
-- ============================================================================

-- ---------------------------------------------------------------------------
-- slugify: "Nong's Barber Shop " -> "nongs-barber-shop"
--
-- Non-ASCII characters (accents, Thai script) collapse to separators rather
-- than being transliterated. The slug is only a URL — the display name is what
-- users actually read — and `unique_business_slug` below guarantees the result
-- is still unique, so a fully Thai name becomes "business-7" rather than
-- colliding.
-- ---------------------------------------------------------------------------
create or replace function public.slugify(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      regexp_replace(
        regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'),
        '(^-+|-+$)', '', 'g'
      ),
      ''
    ),
    'business'
  );
$$;

-- ---------------------------------------------------------------------------
-- unique_business_slug: appends -2, -3 … until the slug is free
-- ---------------------------------------------------------------------------
create or replace function public.unique_business_slug(desired text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  base      text := public.slugify(desired);
  candidate text := base;
  n         int  := 1;
begin
  while exists (select 1 from public.businesses b where b.slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n::text;
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auth wiring: every auth.users row gets a profile.
-- The role comes from the sign-up metadata; anything unrecognised (e.g. a bare
-- Google OAuth sign-in) falls back to 'customer'.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_role text := coalesce(new.raw_user_meta_data ->> 'role', 'customer');
begin
  insert into public.profiles (id, role, full_name, phone, email, avatar_url)
  values (
    new.id,
    case when meta_role = 'business_owner' then 'business_owner'::public.user_role
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the mirrored email in sync when the user changes it.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- RLS helpers.
--
-- Both are SECURITY DEFINER so that a policy on `bookings` can consult
-- `businesses` without re-entering that table's own RLS policies (which would
-- recurse). They are STABLE so the planner calls them once per statement.
-- ---------------------------------------------------------------------------
create or replace function public.owns_business(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = target
      and b.owner_id = (select auth.uid())
  );
$$;

create or replace function public.business_is_visible(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = target
      and (b.is_published or b.owner_id = (select auth.uid()))
  );
$$;

-- ---------------------------------------------------------------------------
-- Defence in depth: a booking must always sit inside the business's published
-- availability. The application computes slots in `src/lib/booking/slots.ts`
-- and re-validates on the server, but the database refuses anything that slips
-- through — including rows written by a compromised client.
--
-- All comparisons happen in "minutes since local midnight" so that a booking
-- running up to the end of the day is handled correctly rather than wrapping
-- around to 00:00 and silently passing an `end_time <= close_time` test.
-- ---------------------------------------------------------------------------
create or replace function public.assert_booking_within_availability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz          text;
  local_start timestamp;
  local_end   timestamp;
  day         date;
  dow         smallint;
  ovr         record;
  open_t      time;
  close_t     time;
  start_min   numeric;
  end_min     numeric;
  open_min    numeric;
  close_min   numeric;
begin
  -- Cancelled / completed rows are history; only gate rows that hold a slot.
  if new.status not in ('pending', 'confirmed') then
    return new;
  end if;

  select b.timezone into tz from public.businesses b where b.id = new.business_id;
  if tz is null then
    raise exception 'Unknown business %', new.business_id;
  end if;

  local_start := new.starts_at at time zone tz;
  local_end   := new.ends_at   at time zone tz;
  day         := local_start::date;
  dow         := extract(dow from local_start)::smallint;

  select * into ovr
  from public.availability_overrides o
  where o.business_id = new.business_id and o.date = day;

  if found then
    if ovr.is_closed then
      raise exception 'Business is closed on %', day;
    end if;
    open_t  := ovr.open_time;
    close_t := ovr.close_time;
  else
    select h.open_time, h.close_time into open_t, close_t
    from public.business_hours h
    where h.business_id = new.business_id
      and h.weekday = dow
      and not h.is_closed;

    if not found then
      raise exception 'Business is closed on %', day;
    end if;
  end if;

  start_min := extract(epoch from (local_start - day::timestamp)) / 60;
  end_min   := extract(epoch from (local_end   - day::timestamp)) / 60;
  open_min  := extract(epoch from open_t)  / 60;
  close_min := extract(epoch from close_t) / 60;

  if start_min < open_min or end_min > close_min then
    raise exception
      'Booking (minutes %–% of %) falls outside opening hours (%–%)',
      start_min, end_min, day, open_t, close_t;
  end if;

  if exists (
    select 1
    from public.business_breaks br
    where br.business_id = new.business_id
      and br.weekday = dow
      and extract(epoch from br.start_time) / 60 < end_min
      and extract(epoch from br.end_time)   / 60 > start_min
  ) then
    raise exception 'Booking overlaps a scheduled break';
  end if;

  return new;
end;
$$;

create trigger bookings_within_availability
  before insert or update of starts_at, ends_at, status, business_id
  on public.bookings
  for each row execute function public.assert_booking_within_availability();
