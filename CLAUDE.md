# Bookly — project rules

## What this is
Multi-vertical booking platform (salons, barbers, clinics, events).
Two roles: `customer` and `business_owner`. Web app (PWA), no native app.

## Stack
Next.js 15 App Router, TypeScript strict, Tailwind v4, shadcn/ui-style
components vendored in `src/components/ui`, Supabase (Auth + Postgres + RLS),
Google Maps Places, date-fns-tz.

## Non-negotiables
- All times stored in UTC (`timestamptz`); displayed in the business's
  timezone (default `Asia/Bangkok`).
- No booking may be created outside a business's published availability.
  The check lives in `src/lib/booking/slots.ts` and is re-run server-side on
  every mutation — never trust a slot the client sends.
- Every table has RLS; customers never see other customers' bookings.
- Prefer the existing primitives in `src/components/ui` over custom UI.
- No new dependency without saying why.

## Mobile-first is a hard requirement
Most traffic is phones and tablets. Every screen must be built and checked at
360px wide before anything else.
- Minimum interactive target: 44x44px (`min-h-11`). Never rely on hover alone.
- Respect safe areas: use the `pb-safe` / `pt-safe` utilities on fixed bars.
- Primary actions sit within thumb reach — bottom of the viewport on mobile,
  not the top right.
- Inputs use `text-base` (16px) or larger so iOS Safari does not zoom on focus.
- No horizontal scroll at any width. Tables become cards below `md`.
- Layout switches at `md` (768px): bottom tab bar + stacked content on mobile,
  persistent sidebar + multi-column on desktop.

## Conventions
- `src/app/(customer)/…`, `src/app/(business)/…`, `src/app/(auth)/…`
- Server Actions for mutations; Supabase client only in server code
  (`src/lib/supabase/server.ts`). The browser client is auth-only.
- Migrations in `supabase/migrations/`, never edit the DB by hand.
- Run `npm run lint && npm run typecheck && npm test` before declaring a task
  done.

## Commands
npm run dev | npm run build | npm run lint | npm run typecheck | npm test | supabase db push
