# Bookly

A booking platform for salons, barbers, clinics, spas and studios. Two portals
behind one sign-in: **customers** find a place and book a real time slot,
**businesses** publish their hours once and get a calendar that fills itself.

Built as a PWA. There is no native app — it installs to the home screen and
runs full screen.

---

## What works today

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
- Services with duration, tidy-up buffer and price
- Opening hours per day with a closed toggle and an optional break
- Day and week calendar, with confirm / complete / no-show / cancel
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

## Getting started

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Create a Supabase project

At [supabase.com](https://supabase.com), then copy the project URL and anon key
from **Project Settings → API** into `.env.local`.

### 3. Apply the migrations

With the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Or paste each file in `supabase/migrations/` into the SQL editor, in filename
order.

### 4. Enable Google sign-in (optional)

**Authentication → Providers → Google** in the Supabase dashboard. Add
`https://<your-project>.supabase.co/auth/v1/callback` as an authorised redirect
URI in the Google Cloud console.

### 5. Run it

```bash
npm run dev
```

Open <http://localhost:3000>, choose **I'm a business**, and walk through
onboarding. Then sign up separately as a customer to book.

### 6. Seed some data (optional)

Sign up first — users belong to Supabase Auth, not to the seed — then:

```bash
psql "$DATABASE_URL" -v owner_email="'you@example.com'" -f supabase/seed.sql
```

That attaches two published businesses, seven services, a lunch break and a
holiday override to your account.

---

## Environment variables

| Variable | Required | What it does |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key; all user data access goes through RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | for emails | Server-only. Resolves the counterparty's address when sending a booking email. Never exposed to the browser |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | for the map | Enable *Maps JavaScript API* and *Places API*. Restrict by HTTP referrer |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | no | Map ID for advanced markers. Falls back to `DEMO_MAP_ID`, which is watermarked and rate limited — set a real one for production |
| `RESEND_API_KEY` | no | Booking emails. Without it, sends are skipped and logged |
| `RESEND_FROM` | no | e.g. `Bookly <bookings@yourdomain.com>` |
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
time, closed days, overrides), slug generation and cross-tenant RLS isolation.
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
  migrations/          schema, functions, RLS, availability RPC
  tests/               database acceptance suite
  seed.sql             development data
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
- Drag-to-reschedule on the calendar. `rescheduleBookingAction` exists and
  re-validates correctly; it has no UI yet
