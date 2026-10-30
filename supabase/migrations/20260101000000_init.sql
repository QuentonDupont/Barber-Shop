-- ============================================================================
-- TatNat — core schema
-- ============================================================================
-- Conventions:
--   * every instant is stored as `timestamptz` (UTC). Wall-clock values that
--     belong to a business (opening hours, breaks) are stored as `time` and are
--     interpreted in that business's `timezone` column.
--   * every table gets RLS (see 20260101000001_rls.sql).
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "btree_gist"; -- equality + range in one EXCLUDE

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('customer', 'business_owner');

create type public.business_category as enum (
  'salon', 'barber', 'clinic', 'spa', 'fitness', 'event', 'other'
);

create type public.booking_status as enum (
  'pending', 'confirmed', 'cancelled', 'completed', 'no_show'
);

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user, created by a trigger on auth.users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null default 'customer',
  full_name   text not null default '',
  phone       text,
  email       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Public mirror of auth.users carrying the role that drives portal routing.';

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------
create table public.businesses (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  name           text not null,
  slug           text not null unique,
  category       public.business_category not null default 'other',
  description    text,
  timezone       text not null default 'Asia/Bangkok',
  -- location (Google Places)
  place_id       text,
  address        text,
  lat            double precision,
  lng            double precision,
  -- contact
  phone          text,
  line_id        text,
  cover_url      text,
  -- booking policy
  slot_interval_min   int not null default 15
                       check (slot_interval_min in (5, 10, 15, 20, 30, 60)),
  min_notice_min      int not null default 60 check (min_notice_min >= 0),
  max_advance_days    int not null default 60 check (max_advance_days between 1 and 365),
  auto_confirm        boolean not null default true,
  is_published   boolean not null default false,
  onboarding_step int not null default 0 check (onboarding_step between 0 and 3),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint businesses_name_not_blank check (length(btrim(name)) > 0)
);

create index businesses_owner_id_idx on public.businesses (owner_id);
create index businesses_category_idx on public.businesses (category)
  where is_published;
create index businesses_geo_idx on public.businesses (lat, lng)
  where is_published;

comment on column public.businesses.slot_interval_min is
  'Granularity of offered start times, in minutes. Default 15.';
comment on column public.businesses.min_notice_min is
  'A slot starting sooner than now() + this many minutes is not bookable.';

-- ---------------------------------------------------------------------------
-- business_hours — the weekly template (0 = Sunday … 6 = Saturday)
-- ---------------------------------------------------------------------------
create table public.business_hours (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),
  open_time   time not null default '09:00',
  close_time  time not null default '18:00',
  is_closed   boolean not null default false,
  unique (business_id, weekday),
  constraint business_hours_open_before_close check (open_time < close_time)
);

create index business_hours_business_id_idx on public.business_hours (business_id);

-- ---------------------------------------------------------------------------
-- business_breaks — recurring weekly closures (lunch, etc.)
-- ---------------------------------------------------------------------------
create table public.business_breaks (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),
  start_time  time not null,
  end_time    time not null,
  label       text not null default 'Break',
  constraint business_breaks_start_before_end check (start_time < end_time)
);

create index business_breaks_business_weekday_idx
  on public.business_breaks (business_id, weekday);

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
create table public.services (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  name          text not null,
  description   text,
  duration_min  int not null check (duration_min between 5 and 1440),
  buffer_min    int not null default 0 check (buffer_min between 0 and 240),
  price         numeric(10, 2) not null default 0 check (price >= 0),
  currency      text not null default 'THB',
  is_active     boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint services_name_not_blank check (length(btrim(name)) > 0)
);

create index services_business_id_idx on public.services (business_id);

comment on column public.services.buffer_min is
  'Clean-up time reserved after the service. Counts towards the booked range.';

-- ---------------------------------------------------------------------------
-- staff (v1.1 — the booking engine already honours staff_id when present)
-- ---------------------------------------------------------------------------
create table public.staff (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  name           text not null,
  avatar_url     text,
  works_weekdays smallint[] not null default '{0,1,2,3,4,5,6}',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create index staff_business_id_idx on public.staff (business_id);

-- ---------------------------------------------------------------------------
-- availability_overrides — one-off days (holidays, late opening)
-- ---------------------------------------------------------------------------
create table public.availability_overrides (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  date        date not null,
  is_closed   boolean not null default true,
  open_time   time,
  close_time  time,
  note        text,
  unique (business_id, date),
  constraint availability_overrides_shape check (
    (is_closed and open_time is null and close_time is null)
    or (not is_closed and open_time is not null and close_time is not null
        and open_time < close_time)
  )
);

create index availability_overrides_business_date_idx
  on public.availability_overrides (business_id, date);

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
create table public.bookings (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  service_id     uuid not null references public.services (id) on delete restrict,
  customer_id    uuid not null references public.profiles (id) on delete cascade,
  staff_id       uuid references public.staff (id) on delete set null,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  status         public.booking_status not null default 'pending',
  notes          text,
  -- denormalised so a booking still reads correctly if the service is renamed
  service_name   text not null,
  price          numeric(10, 2) not null default 0,
  currency       text not null default 'THB',
  customer_name  text not null default '',
  customer_phone text,
  cancelled_at   timestamptz,
  cancelled_by   uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint bookings_starts_before_ends check (starts_at < ends_at)
);

create index bookings_business_starts_idx on public.bookings (business_id, starts_at);
create index bookings_customer_starts_idx on public.bookings (customer_id, starts_at desc);

-- The hard guarantee: two bookings that actually hold a slot may never overlap
-- for the same business + staff member.
--
-- `pending` is included on purpose: a request awaiting the owner's confirmation
-- must hold its slot, otherwise the same time can be sold twice while it waits.
-- `staff_id` is coalesced to the nil UUID because NULLs never compare equal in
-- an EXCLUDE constraint, which would let unassigned bookings pile up.
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    business_id with =,
    coalesce(staff_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('pending', 'confirmed'));

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger businesses_touch_updated_at
  before update on public.businesses
  for each row execute function public.touch_updated_at();

create trigger services_touch_updated_at
  before update on public.services
  for each row execute function public.touch_updated_at();

create trigger bookings_touch_updated_at
  before update on public.bookings
  for each row execute function public.touch_updated_at();
