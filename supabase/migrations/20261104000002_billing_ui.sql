-- ===========================================================================
-- Billing screens support (tatnat-accounts-billing handoff 07).
--   N2  guard_founding: a missing settings row now means "cap 0", not "no cap".
--   A6  invoice lines must add up to the invoice subtotal (checked at commit).
--   N1  an invoice can be refunded once: refunded_at / refund_ref, never changed.
--   New table payment_methods: the demo card shown on the billing page.
--       Brand and last four digits only. No card number, no token that works
--       outside the mock provider. Owner reads it; only the billing job writes.
-- Still demo data only: nothing here can take money.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- N2: coalesce on the founding cap (QA report 2, advisory N2).
-- ---------------------------------------------------------------------------
create or replace function public.guard_founding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cap integer;
  granted integer;
begin
  if tg_op = 'UPDATE' and old.founding_granted_at is not null then
    new.founding_granted_at := old.founding_granted_at; -- never cleared
  end if;
  if new.founding and (tg_op = 'INSERT' or not old.founding) then
    if tg_op = 'UPDATE' and old.founding_granted_at is not null then
      raise exception 'founding_already_used: this business has had the founding offer'
        using errcode = 'P0001';
    end if;
    select founding_cap into cap from public.billing_settings for update; -- serialise grants
    -- No settings row (or a null cap) means nobody may be granted the offer.
    cap := coalesce(cap, 0);
    select count(*) into granted from public.subscriptions
      where founding_granted_at is not null and business_id <> new.business_id;
    if granted >= cap then
      raise exception 'founding_cap_reached: the founding cohort is full (%)', cap
        using errcode = 'P0001';
    end if;
    new.founding_granted_at := now();
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- A6: lines add up to the subtotal. A line is quantity x unit price. The sum is
-- checked when the transaction commits, so invoice and lines can be inserted in
-- any order inside one transaction.
-- ---------------------------------------------------------------------------
alter table public.invoice_lines
  add constraint invoice_lines_amount_is_qty_times_unit check (amount_satang = quantity * unit_satang);

create or replace function public.check_invoice_lines_total()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  inv uuid;
  expected bigint;
  n integer;
  s bigint;
begin
  if tg_table_name = 'invoice_lines' then
    inv := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  else
    inv := new.id;
  end if;
  select subtotal_satang into expected from public.invoices where id = inv;
  if expected is null then
    return null; -- the invoice itself is gone (cascade); nothing to check
  end if;
  select count(*), coalesce(sum(amount_satang), 0) into n, s
  from public.invoice_lines where invoice_id = inv;
  if n > 0 and s <> expected then
    raise exception 'invoice_lines_mismatch: lines add up to % but the invoice subtotal is %', s, expected
      using errcode = '23514';
  end if;
  return null;
end $$;

revoke all on function public.check_invoice_lines_total() from public, anon, authenticated;

create constraint trigger invoice_lines_total_on_lines
  after insert or update or delete on public.invoice_lines
  deferrable initially deferred
  for each row execute function public.check_invoice_lines_total();

create constraint trigger invoice_lines_total_on_invoice
  after insert or update of subtotal_satang on public.invoices
  deferrable initially deferred
  for each row execute function public.check_invoice_lines_total();

-- ---------------------------------------------------------------------------
-- N1: one refund per invoice.
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column refunded_at timestamptz,
  add column refund_ref  text,
  add constraint invoices_refund_shape check ((refunded_at is null) = (refund_ref is null));

create unique index invoices_refund_ref_key on public.invoices (refund_ref) where refund_ref is not null;

create or replace function public.guard_invoice_refund()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.refund_ref is not null
     and (new.refund_ref is distinct from old.refund_ref or new.refunded_at is distinct from old.refunded_at) then
    raise exception 'already_refunded: invoice % was refunded once and cannot be refunded again', old.number
      using errcode = 'P0001';
  end if;
  return new;
end $$;

revoke all on function public.guard_invoice_refund() from public, anon, authenticated;

create trigger invoices_guard_refund
  before update on public.invoices
  for each row execute function public.guard_invoice_refund();

-- ---------------------------------------------------------------------------
-- payment_methods: the demo card. Mock provider references only.
-- ---------------------------------------------------------------------------
create table public.payment_methods (
  business_id  uuid primary key references public.businesses (id) on delete cascade,
  brand        text not null check (brand in ('Visa', 'Mastercard', 'JCB')),
  last4        text not null check (last4 ~ '^[0-9]{4}$'),
  exp_month    integer not null check (exp_month between 1 and 12),
  exp_year     integer not null check (exp_year between 2024 and 2100),
  provider_ref text not null check (provider_ref like 'mock\_%'),
  created_at   timestamptz not null default now()
);

alter table public.payment_methods enable row level security;
revoke all on public.payment_methods from anon, authenticated;
grant select on public.payment_methods to authenticated;

create policy "payment methods: owner reads own business"
  on public.payment_methods for select to authenticated
  using (public.owns_business(business_id));
