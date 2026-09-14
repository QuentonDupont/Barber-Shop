# Database tests

These assert the guarantees the application relies on but cannot enforce on its
own — the ones that must hold even if every line of TypeScript is wrong.

* `00_supabase_shim.sql` — a minimal stand-in for the pieces of a Supabase
  project the migrations reference (`auth.users`, `auth.uid()`, the `anon` /
  `authenticated` / `service_role` roles). Only for local runs; the hosted
  platform provides all of it.
* `10_booking_invariants.sql` — the exclusion constraint, the availability
  trigger (breaks, closing time, closed days, overrides) and slug generation.
* `20_rls_isolation.sql` — cross-tenant isolation: what each role can read and
  write, and the `busy_intervals` RPC that lets the slot engine see other
  customers' bookings as opaque ranges without leaking anything about them.

Run them with:

```bash
./supabase/tests/run.sh
```

Against a local `supabase start`:

```bash
PGHOST=localhost PGPORT=54322 PGUSER=postgres PGPASSWORD=postgres \
  ./supabase/tests/run.sh
```
