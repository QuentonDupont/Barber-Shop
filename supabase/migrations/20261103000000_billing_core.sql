-- ===========================================================================
-- TatNat billing core (tatnat-accounts-billing handoff 05; decision 25).
--
-- Demo-data foundation only: plans, subscriptions, invoices, the barber limit,
-- invoice numbering. Nothing here can take money:
--   * subscriptions.provider is constrained to 'mock';
--   * no card data is stored, ever;
--   * browser roles can only READ their own business's billing rows. Every
--     write goes through the service role (the billing job).
--
-- The subscription state machine lives in TypeScript (src/lib/billing/state.ts)
-- and is the single source of truth for transitions. The database keeps only
-- what must hold even if every line of TypeScript is wrong: row ownership, the
-- barber limit, gap-free invoice numbers, and consistent amounts.
--
-- Customers never read any of this and nothing here touches the public booking
-- tables: no code path unpublishes a shop or blocks bookings for non-payment.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- plans: public price list (decision 25). Money is integer satang.
-- ---------------------------------------------------------------------------
create table public.plans (
  id           text primary key check (id in ('free', 'pro', 'studio')),
  name_en      text not null,
  name_th      text not null,
  price_satang integer not null check (price_satang >= 0),
  max_staff    integer not null check (max_staff > 0),
  paid_extras  boolean not null default false,
  sort         integer not null
);

insert into public.plans (id, name_en, name_th, price_satang, max_staff, paid_extras, sort) values
  ('free',   'Free',   'ฟรี',      0,     2,  false, 1),
  ('pro',    'Pro',    'โปร',      49000, 5,  true,  2),
  ('studio', 'Studio', 'สตูดิโอ',  99000, 15, true,  3);

-- ---------------------------------------------------------------------------
-- billing_settings: one row. VAT is OFF while TatNat is below the registration
-- threshold (THB 1.8M a year); the flag is here for the day that changes.
-- Service role only (no policies).
-- ---------------------------------------------------------------------------
create table public.billing_settings (
  id                   boolean primary key default true check (id),
  vat_enabled          boolean not null default false,
  vat_rate_bp          integer not null default 700 check (vat_rate_bp between 0 and 2000),
  vat_threshold_satang bigint  not null default 180000000,
  updated_at           timestamptz not null default now()
);
insert into public.billing_settings default values;

-- ---------------------------------------------------------------------------
-- subscriptions: one row per business.
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  business_id          uuid primary key references public.businesses (id) on delete cascade,
  plan_id              text not null default 'free' references public.plans (id),
  previous_plan_id     text references public.plans (id),
  status               text not null default 'active'
                       check (status in ('trialing', 'active', 'past_due', 'grace', 'downgraded', 'cancelled')),
  founding             boolean not null default false,
  anchor               date not null default ((now() at time zone 'Asia/Bangkok')::date),
  period_index         integer not null default 0 check (period_index >= 0),
  due_date             date,
  grace_until          timestamptz,
  reminder_sent_for    date,
  dunning_sent         integer[] not null default '{}',
  cancel_at_period_end boolean not null default false,
  -- There is no live provider in this build; the database refuses anything else.
  provider             text not null default 'mock' check (provider = 'mock'),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint subscriptions_free_shape check (
    plan_id <> 'free' or (status in ('active', 'downgraded', 'cancelled') and not founding)
  ),
  constraint subscriptions_grace_shape check (
    (status in ('past_due', 'grace')) = (grace_until is not null)
  )
);

alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

create policy "subscriptions: owner reads own business"
  on public.subscriptions for select to authenticated
  using (public.owns_business(business_id));

-- Every business has a subscription; a new business starts on Free.
create or replace function public.create_free_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (business_id) values (new.id) on conflict do nothing;
  return new;
end $$;

revoke all on function public.create_free_subscription() from public, anon, authenticated;

drop trigger if exists businesses_create_subscription on public.businesses;
create trigger businesses_create_subscription
  after insert on public.businesses
  for each row execute function public.create_free_subscription();

insert into public.subscriptions (business_id)
select id from public.businesses
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Invoice numbering: TN-<Bangkok year>-<6 digits>, sequential and gap-free.
-- The counter row is locked until the surrounding transaction ends, and a
-- rollback undoes the increment, so a failed charge never burns a number.
-- ---------------------------------------------------------------------------
create table public.invoice_counters (
  year     integer primary key,
  last_seq integer not null check (last_seq >= 0)
);
alter table public.invoice_counters enable row level security;
revoke all on public.invoice_counters from anon, authenticated;

create or replace function public.allocate_invoice_number(p_year integer)
returns table (seq integer, number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  s integer;
begin
  insert into public.invoice_counters as c (year, last_seq) values (p_year, 1)
  on conflict (year) do update set last_seq = c.last_seq + 1
  returning c.last_seq into s;
  return query select s, format('TN-%s-%s', p_year, lpad(s::text, 6, '0'));
end $$;

revoke all on function public.allocate_invoice_number(integer) from public, anon, authenticated;
grant execute on function public.allocate_invoice_number(integer) to service_role;

-- ---------------------------------------------------------------------------
-- invoices and lines. Receipt data only; no PDF yet.
-- Billing records are kept 5 years (Legal handoff 02), so a business that still
-- has invoices cannot be hard-deleted: on delete restrict. The deletion /
-- anonymisation flow for such businesses is a follow-up with Legal.
-- ---------------------------------------------------------------------------
create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete restrict,
  year           integer not null,
  seq            integer not null check (seq > 0),
  number         text not null unique,
  kind           text not null check (kind in ('receipt', 'receipt_tax_invoice')),
  full_form      boolean not null default false,
  status         text not null default 'paid' check (status in ('paid', 'void')),
  issued_at      timestamptz not null default now(),
  issue_date     date not null,
  period_start   date not null,
  period_end     date not null,
  currency       text not null default 'THB' check (currency = 'THB'),
  subtotal_satang bigint not null check (subtotal_satang >= 0),
  vat_satang     bigint not null default 0 check (vat_satang >= 0),
  vat_rate_bp    integer not null default 0 check (vat_rate_bp >= 0),
  vat_applied    boolean not null default false,
  total_satang   bigint not null check (total_satang > 0),
  buyer          jsonb not null default '{}'::jsonb,
  payment_ref    text not null,
  created_at     timestamptz not null default now(),
  unique (year, seq),
  constraint invoices_amounts_add_up check (subtotal_satang + vat_satang = total_satang),
  constraint invoices_vat_shape check (vat_applied or (vat_satang = 0 and vat_rate_bp = 0)),
  constraint invoices_number_format check (number = format('TN-%s-%s', year, lpad(seq::text, 6, '0'))),
  constraint invoices_period_order check (period_start <= period_end)
);
create index invoices_business_idx on public.invoices (business_id, issued_at desc);

create table public.invoice_lines (
  id             uuid primary key default gen_random_uuid(),
  invoice_id     uuid not null references public.invoices (id) on delete cascade,
  position       integer not null check (position > 0),
  description_th text not null,
  description_en text not null,
  quantity       integer not null check (quantity > 0),
  unit_satang    bigint not null check (unit_satang >= 0),
  amount_satang  bigint not null check (amount_satang >= 0),
  unique (invoice_id, position)
);

alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
revoke all on public.invoices, public.invoice_lines from anon, authenticated;
grant select on public.invoices, public.invoice_lines to authenticated;

create policy "invoices: owner reads own business"
  on public.invoices for select to authenticated
  using (public.owns_business(business_id));

create policy "invoice lines: owner reads own business"
  on public.invoice_lines for select to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_id and public.owns_business(i.business_id)
  ));

-- ---------------------------------------------------------------------------
-- plans and settings access
-- ---------------------------------------------------------------------------
alter table public.plans enable row level security;
revoke all on public.plans from anon, authenticated;
grant select on public.plans to anon, authenticated;
create policy "plans: anyone reads the price list"
  on public.plans for select to anon, authenticated using (true);

alter table public.billing_settings enable row level security;
revoke all on public.billing_settings from anon, authenticated;

-- Job-only audit trail (reminders sent, downgrades applied). No policies: service role only.
create table public.billing_events (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind        text not null,
  ref         text not null,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (business_id, kind, ref)
);
alter table public.billing_events enable row level security;
revoke all on public.billing_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The plan in force. Unpaid or lapsed ALWAYS resolves to Free, never to "off".
-- Mirrors effectivePlanId() in src/lib/billing/state.ts.
-- ---------------------------------------------------------------------------
create or replace function public.effective_plan_id(target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when s.status in ('downgraded', 'cancelled') then 'free'
      when s.status in ('past_due', 'grace') and (s.grace_until is null or s.grace_until <= now()) then 'free'
      else s.plan_id
    end
    from public.subscriptions s
    where s.business_id = target
  ), 'free');
$$;

revoke all on function public.effective_plan_id(uuid) from public, anon, authenticated;
grant execute on function public.effective_plan_id(uuid) to service_role;

-- What an owner may ask: the plan of a business they own. Null for anyone else.
create or replace function public.my_effective_plan(target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.owns_business(target) then public.effective_plan_id(target) end;
$$;

revoke all on function public.my_effective_plan(uuid) from public, anon;
grant execute on function public.my_effective_plan(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The barber limit. Enforced on the owner write path only: a barber cannot be
-- added or re-activated beyond what the plan in force allows. Nothing else in
-- the system looks at the plan.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_staff_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lim integer;
  active_now integer;
begin
  if not new.is_active then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.is_active and old.business_id = new.business_id then
    return new; -- already counted; renaming etc. is never blocked
  end if;

  -- Serialise concurrent adds for one business so two requests cannot both squeeze in.
  perform 1 from public.businesses b where b.id = new.business_id for update;

  select p.max_staff into lim
  from public.plans p
  where p.id = public.effective_plan_id(new.business_id);

  select count(*) into active_now
  from public.staff s
  where s.business_id = new.business_id and s.is_active and s.id <> new.id;

  if active_now + 1 > lim then
    raise exception 'staff_limit_exceeded: your plan allows % active barbers', lim
      using errcode = 'P0001', hint = 'Upgrade the plan or deactivate a barber first.';
  end if;
  return new;
end $$;

revoke all on function public.enforce_staff_limit() from public, anon, authenticated;

drop trigger if exists staff_enforce_limit on public.staff;
create trigger staff_enforce_limit
  before insert or update of is_active, business_id on public.staff
  for each row execute function public.enforce_staff_limit();

-- ---------------------------------------------------------------------------
-- Downgrade to Free: extra barbers go inactive (hidden from booking, history
-- kept); nothing is deleted and nothing is unpublished. The owner may choose
-- who stays; otherwise the oldest stay. Called by the billing job (service role).
-- ---------------------------------------------------------------------------
create or replace function public.apply_free_limits(p_business uuid, p_keep uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  lim integer;
  keep uuid[];
  n integer;
begin
  select max_staff into lim from public.plans where id = 'free';

  select coalesce(array_agg(k.id), '{}') into keep
  from (
    select s.id
    from public.staff s
    where s.business_id = p_business and s.is_active
    order by (s.id = any (coalesce(p_keep, '{}'))) desc, s.created_at, s.id
    limit lim
  ) k;

  update public.staff
  set is_active = false
  where business_id = p_business and is_active and not (id = any (keep));
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.apply_free_limits(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.apply_free_limits(uuid, uuid[]) to service_role;
