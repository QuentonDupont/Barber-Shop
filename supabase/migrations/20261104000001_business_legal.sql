-- Owner account: legal / tax details for a business (tatnat-accounts-billing,
-- handoff 07, test O5). Kept in its OWN table, never on the public
-- `businesses` row, so no public read of `businesses` can ever return a tax id.
-- Owner-only through RLS: select/insert/update via owns_business(); there is no
-- policy for anon, customers or rival owners, and no delete policy (the row
-- goes with the business via the cascade). All fields are optional until the
-- shop wants a full tax invoice (feasibility.md section 6, legal-review D).

-- Thai tax-ID check digit: sum of the first 12 digits weighted 13..2, then
-- (11 - sum mod 11) mod 10 must equal the 13th digit.
create or replace function public.is_valid_thai_tax_id(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value ~ '^[0-9]{13}$'
     and ((11 - (
            select sum(substr(value, i, 1)::int * (14 - i))
            from generate_series(1, 12) as i
          ) % 11) % 10) = substr(value, 13, 1)::int;
$$;

create table if not exists public.business_legal (
  business_id    uuid primary key references public.businesses (id) on delete cascade,
  legal_name     text check (legal_name is null or char_length(legal_name) <= 160),
  tax_id         text check (tax_id is null or public.is_valid_thai_tax_id(tax_id)),
  -- 00000 = head office, otherwise the 5-digit branch number.
  branch_code    text not null default '00000' check (branch_code ~ '^[0-9]{5}$'),
  tax_address    text check (tax_address is null or char_length(tax_address) <= 400),
  vat_registered boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.business_legal enable row level security;

-- Nothing for anon; the owner path only.
revoke all on public.business_legal from anon;

create policy business_legal_owner_select on public.business_legal
  for select to authenticated
  using (public.owns_business(business_id));

create policy business_legal_owner_insert on public.business_legal
  for insert to authenticated
  with check (public.owns_business(business_id));

create policy business_legal_owner_update on public.business_legal
  for update to authenticated
  using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create trigger business_legal_touch_updated_at
  before update on public.business_legal
  for each row execute function public.touch_updated_at();
