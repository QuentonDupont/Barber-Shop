# TatNat

A booking platform for salons, barbers, clinics, spas and studios. Two portals
behind one sign-in: **customers** find a place and book a real time slot,
**businesses** publish their hours once and get a calendar that fills itself.

Built as a PWA. There is no native app — it installs to the home screen and
runs full screen.

---

## What works today

**Public booking page** — `/b/<shop-name>`
- Anyone can open it, signed in or not, so a shop can share the link on LINE,
  Instagram or a flyer. A visitor picks a time, taps *Sign in to book*, and
  lands back on the same shop and day after signing in or signing up

**Customer**
- Search and filter published businesses, sorted by distance when location is
  allowed
- Business page with services, a month calendar that greys out closed and fully
  booked days, and a slot picker fed by real availability
- Confirm with an optional note; instant confirmation or a request, depending on
  the shop's setting
- "My bookings" with upcoming/history tabs, directions, one-tap call and cancel

**Business**
- Three-step onboarding: identity, location (Google Places search + draggable
  map pin), weekly opening hours
- Services with name, description, duration, tidy-up buffer and price — every
  field is editable and updates the customer page as soon as it's saved.
  Show/hide, reorder, and a "Preview your page" button to see exactly what
  customers see (works before publishing, too)
- Opening hours per day with a closed toggle and an optional break
- Day and week calendar, with confirm / complete / no-show / cancel
- Reschedule: a "Move" sheet that works with a thumb (flick to a day, tap a
  time), and drag-and-drop on the desktop timeline — both re-validated
  server-side against hours, breaks and other bookings
- Holidays and one-off days: close a date or give it different hours. Refuses
  to close a day that already has bookings on it
- Settings: publishing, time zone, slot interval, minimum notice, booking
  horizon, auto-confirm

**Both**
- Email + password and Google sign-in, role chosen at sign-up
- Booking emails via Resend (skipped silently when unconfigured)
- Light and dark themes, per device

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript strict |
| UI | Tailwind v4, shadcn/ui-style primitives vendored in `src/components/ui` |
| Auth + data | Supabase (Postgres, Auth, Row Level Security) |
| Maps | Google Maps JavaScript API — Places + Marker |
| Dates | `date-fns` + `date-fns-tz` |
| Email | Resend |
| PWA | Hand-written manifest + service worker |

---

## Run it locally

The whole stack — Postgres, auth, the API, an email catcher — runs on your
machine with one command. You need two things installed first:

1. **Node.js 20+** — <https://nodejs.org>
2. **Docker Desktop** — <https://www.docker.com/products/docker-desktop/>
   (free for personal use; it just needs to be running)

Then:

```bash
git clone <this repo> && cd Barber-Shop
npm install
npm run local
```

`npm run local` starts Supabase in Docker, writes its URL and keys into
`.env.local`, applies every migration and the seed, and starts the app. The
first run downloads the Supabase images and takes a few minutes; after that
it's seconds.

Open **<http://localhost:3000>** and sign in as either demo account:

| Portal | Email | Password |
|---|---|---|
| Business — *Nong Barber*, already set up and published | `owner@tatnat.local` | `tatnat123` |
| Customer | `customer@tatnat.local` | `tatnat123` |

Or create your own account from the landing page — sign-up works instantly
locally because email confirmation is switched off in `supabase/config.toml`.

**To try it on your phone**, find your computer's local IP (`ipconfig` on
Windows, `ifconfig` or System Settings → Wi-Fi on a Mac) and open
`http://<that-ip>:3000` on the phone, on the same Wi-Fi.

Useful while it's running:

| | |
|---|---|
| `http://127.0.0.1:54323` | Supabase Studio — browse and edit the database |
| `http://127.0.0.1:54324` | Every email the app sent, caught locally |
| `npm run db:reset` | Wipe the database and re-seed |
| `npm run db:stop` | Stop the Docker containers |
| `npm run db:test` | The database acceptance suite (needs `psql`) |

### Without Docker

Use a free hosted project instead. Create one at
[supabase.com](https://supabase.com), copy the URL and anon key from
**Project Settings → API** into `.env.local`, then:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
npm run dev
```

Sign up through the app to create your first account. If you want the demo
data, paste `supabase/seed.sql` into the SQL editor — but note it creates two
users with a known password, so only do that on a project nobody else uses.

### Google sign-in (optional)

**Authentication → Providers → Google** in the Supabase dashboard, or for the
local stack put the client id and secret in `supabase/.env` and flip
`[auth.external.google] enabled = true` in `supabase/config.toml`. Add
`https://<your-project>.supabase.co/auth/v1/callback` as an authorised
redirect URI in the Google Cloud console.

## Environment variables

| Variable | Required | What it does |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key; all user data access goes through RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | for emails | Server-only. Resolves the counterparty's address when sending a booking email. Never exposed to the browser |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | for the map | Enable *Maps JavaScript API* and *Places API*. Restrict by HTTP referrer |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | no | Map ID for advanced markers. Falls back to `DEMO_MAP_ID`, which is watermarked and rate limited — set a real one for production |
| `RESEND_API_KEY` | no | Booking emails. Without it, sends are skipped and logged |
| `RESEND_FROM` | no | e.g. `TatNat <bookings@yourdomain.com>` |
| `NEXT_PUBLIC_SITE_URL` | no | Used for OAuth redirects and metadata |

The app degrades rather than crashing: without Maps the location step becomes a
text field, without Resend nothing is emailed, and without Supabase the landing
page explains what to configure.

---

## How availability works

This is the part worth understanding before changing anything.

`src/lib/booking/slots.ts` is a **pure function**. Given opening hours, breaks,
same-day overrides, existing bookings, the slot interval, the notice window and
the booking horizon, it returns the bookable start times for one day. It has no
database access and no ambient clock — `now` is an argument — so it is fully
unit tested (`npm test`).

Three things then guard the invariant, in order:

1. **The client** only ever shows slots the engine produced.
2. **The server** never trusts what the client posts back. `createBookingAction`
   recomputes the whole day and looks the requested instant up in the result
   (`findSlot`). A start time that is not on offer is refused.
3. **The database** has the final say: a GiST exclusion constraint makes two
   overlapping live bookings impossible, and a `BEFORE INSERT` trigger re-checks
   opening hours, breaks and overrides. Even a write that bypasses the app
   entirely cannot create an impossible booking.

Every instant is stored as `timestamptz` (UTC) and displayed in the business's
own time zone, so a customer booking from another country still sees 2pm mean
2pm at the shop.

One subtlety worth keeping: availability does **not** read `bookings` directly.
RLS deliberately hides other customers' rows, so a customer computing their own
availability would see an almost empty day. The `busy_intervals` RPC (a
`SECURITY DEFINER` function) returns anonymous start/end pairs and nothing else —
no customer, service, price or booking id.

---

## Mobile

Most of this traffic is phones. The rules are in `CLAUDE.md` and are enforced in
review, but the short version:

- Every screen is designed at **360px** first
- **44×44px** minimum on anything tappable
- Inputs are 16px, so iOS Safari never zooms the viewport on focus
- `viewport-fit=cover` plus `pb-safe` / `pt-safe` utilities for notched devices
- Primary actions sit at the bottom of the viewport, in thumb reach
- No horizontal scroll at any width — dense tables become cards, and the week
  calendar becomes a grouped agenda
- Bottom tab bar below `md`, persistent sidebar above it

---

## Testing

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm test            # vitest — the availability engine
npm run build       # production build
```

Database guarantees have their own suite, which applies every migration to a
throwaway database and asserts the invariants:

```bash
./supabase/tests/run.sh
```

It covers the overlap constraint, the availability trigger (breaks, closing
time, closed days, overrides), rescheduling, one-off closures, slug generation,
cross-tenant RLS isolation, and that the seed produces two working logins.
See `supabase/tests/README.md`.

---

## Project layout

```
src/
  app/
    (auth)/            sign-in, sign-up
    (customer)/app/    explore, business page, bookings, account
    (business)/dashboard/  today, calendar, services, hours, settings, onboarding
    auth/callback/     OAuth code exchange
  components/
    ui/                shadcn-style primitives
    shared/            app shell, navigation, account menu
    customer/          discovery and the booking flow
    business/          onboarding, hours, services, calendar
  lib/
    booking/           slots.ts (pure engine), time.ts, availability.ts
    actions/           Server Actions — every mutation
    supabase/          server, browser and middleware clients
supabase/
  config.toml          local stack settings (ports, auth, email catcher)
  migrations/          schema, functions, RLS, availability RPC
  tests/               database acceptance suite
  seed.sql             demo logins and businesses, applied by `db reset`
scripts/
  local-env.mjs        writes the running stack's keys into .env.local
```

---

## Deploying

Push to GitHub, import the repo in Vercel, add the environment variables above,
deploy. Set `NEXT_PUBLIC_SITE_URL` to the production URL and add
`https://<your-domain>/auth/callback` to the Supabase auth redirect allowlist.

---

## Not built yet

- LINE login and LINE booking notifications
- Multiple staff per business — the schema and the booking engine already carry
  `staff_id`, but there is no UI for it
- Deposits and prepayment
- Reviews, analytics, and an embeddable booking widget
