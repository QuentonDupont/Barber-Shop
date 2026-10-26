-- ============================================================================
-- TatNat beta operations must-haves (operations-plan.md §4 "Dependencies on
-- Engineering"; handoff 10). Four things, so the roadmap §5 kill/pivot gate
-- numbers can be computed honestly:
--
--   1. bookings.source  - who created the booking: the customer, or the shop
--   2. no-show guard    - a booking can be marked no-show only once it has
--                         started, and only from pending/confirmed
--   3. health_check()   - a "health" address for the uptime monitor that
--                         really touches the database
--   4. weekly metrics   - two views Data & Analytics (and the owner page)
--                         read: per shop per week, and totals per week
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Who made the booking
-- ---------------------------------------------------------------------------
create type public.booking_source as enum ('customer', 'shop');

alter table public.bookings
  add column source public.booking_source not null default 'customer';

comment on column public.bookings.source is
  'Who created the booking. Stamped by the database from the signed-in user, never trusted from the client: a booking inserted by the shop''s own owner is ''shop'', anything else is ''customer''. Callers with no signed-in user (service role, migrations, imports) may set it explicitly. Immutable for signed-in users.';

create or replace function public.stamp_booking_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    -- Service role / migration / import: trust the value given (default 'customer').
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.source := case
      when public.owns_business(new.business_id) then 'shop'::public.booking_source
      else 'customer'::public.booking_source
    end;
  elsif new.source is distinct from old.source then
    raise exception 'Booking source cannot be changed';
  end if;

  return new;
end;
$$;

create trigger bookings_stamp_source
  before insert or update on public.bookings
  for each row execute function public.stamp_booking_source();

-- ---------------------------------------------------------------------------
-- 2. No-show only after the appointment time, and only from a live booking.
--    (Customers are already blocked from setting no_show by
--    guard_booking_status_change; this protects the gate numbers from an
--    owner mis-tap on a future booking or on a cancelled one.)
-- ---------------------------------------------------------------------------
create or replace function public.guard_booking_no_show()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'no_show' and old.status is distinct from 'no_show' then
    if old.status not in ('pending', 'confirmed') then
      raise exception 'Only a pending or confirmed booking can be marked no-show';
    end if;
    if old.starts_at > now() then
      raise exception 'A booking can be marked no-show only after its start time';
    end if;
  end if;
  return new;
end;
$$;

create trigger bookings_guard_no_show
  before update of status on public.bookings
  for each row execute function public.guard_booking_no_show();

-- ---------------------------------------------------------------------------
-- 3. Health check. Does one real read of a real table, returns nothing but
--    "ok" and the time. Callable by the anonymous role on purpose: the uptime
--    monitor has no login.
-- ---------------------------------------------------------------------------
create or replace function public.health_check()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  probe bigint;
begin
  select count(*) into probe from (select 1 from public.businesses limit 1) s;
  return jsonb_build_object('ok', true, 'checked_at', now());
end;
$$;

revoke all on function public.health_check() from public;
grant execute on function public.health_check() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Weekly numbers.
--
-- Definitions (mirrored in src/lib/metrics/weekly.ts; keep them in step):
--   * week            Monday-start, in the SHOP's own timezone, by the
--                     appointment time (starts_at), not by when it was made.
--   * bookings_total  every booking that week except cancelled ones
--   * customer_booked non-cancelled, source = 'customer'
--   * shop_entered    non-cancelled, source = 'shop'
--   * no_shows        status = 'no_show'
--   * no_show_rate    no_shows / (completed + no_shows); null if neither
--   * is_weekly_active  customer_booked >= 3  (operations-plan.md §4: a shop is
--                     "weekly-active" with at least 3 bookings made BY CUSTOMERS)
--
-- security_invoker: the caller's own row-level security applies. An owner
-- sees only their own shop; a customer sees nothing (owns no shop); the
-- service role and database admins (no signed-in user) see every shop.
-- ---------------------------------------------------------------------------
create view public.beta_weekly_shop_metrics
with (security_invoker = true)
as
with agg as (
  select
    b.id   as business_id,
    b.name as business_name,
    (date_trunc('week', bk.starts_at at time zone b.timezone))::date as week_start,
    count(*) filter (where bk.status <> 'cancelled')                                  as bookings_total,
    count(*) filter (where bk.status <> 'cancelled' and bk.source = 'customer')       as customer_booked,
    count(*) filter (where bk.status <> 'cancelled' and bk.source = 'shop')           as shop_entered,
    count(*) filter (where bk.status = 'completed')                                   as completed,
    count(*) filter (where bk.status = 'no_show')                                     as no_shows,
    count(*) filter (where bk.status = 'cancelled')                                   as cancelled
  from public.bookings bk
  join public.businesses b on b.id = bk.business_id
  where (select auth.uid()) is null or public.owns_business(b.id)
  group by b.id, b.name, (date_trunc('week', bk.starts_at at time zone b.timezone))::date
)
select
  business_id,
  business_name,
  week_start,
  bookings_total,
  customer_booked,
  shop_entered,
  completed,
  no_shows,
  cancelled,
  round(no_shows::numeric / nullif(completed + no_shows, 0), 3) as no_show_rate,
  (customer_booked >= 3) as is_weekly_active
from agg;

create view public.beta_weekly_totals
with (security_invoker = true)
as
select
  s.week_start,
  count(*) filter (where s.bookings_total > 0)  as shops_with_bookings,
  count(*) filter (where s.is_weekly_active)    as active_shops,
  (
    select count(*)
    from public.businesses b
    where b.is_published
      and (b.created_at at time zone b.timezone)::date < s.week_start + 7
  )                                             as onboarded_shops,
  sum(s.bookings_total)::bigint                 as bookings_total,
  sum(s.customer_booked)::bigint                as customer_booked,
  sum(s.shop_entered)::bigint                   as shop_entered,
  sum(s.completed)::bigint                      as completed,
  sum(s.no_shows)::bigint                       as no_shows,
  sum(s.cancelled)::bigint                      as cancelled,
  round(sum(s.no_shows)::numeric / nullif(sum(s.completed) + sum(s.no_shows), 0), 3) as no_show_rate
from public.beta_weekly_shop_metrics s
group by s.week_start;

revoke all on public.beta_weekly_shop_metrics from public, anon;
revoke all on public.beta_weekly_totals       from public, anon;
grant select on public.beta_weekly_shop_metrics to authenticated, service_role;
grant select on public.beta_weekly_totals       to authenticated, service_role;
