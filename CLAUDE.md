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
- No horizontal scroll at any width. Tables become cards below `sm`.
- Chrome switches at `md` (768px): bottom tab bar below, persistent sidebar
  above. Content switches at `sm` (640px). See the responsive contract below —
  these are two different breakpoints and confusing them creates the 640–767px
  gap.

## Responsive contract — app experience and web experience

Bookly is one codebase serving two deliberate experiences, and it must hold at
**every** width in between. Neither is an afterthought.

**App experience (touch, below `md`)** — bottom tab bar, single column, bottom
sheets, thumb-reach primary actions, native pickers (`<input type="time">`),
lists instead of grids. This is the installed-PWA experience and most traffic.

**Web experience (pointer, `md` and up)** — persistent sidebar, multi-column,
centred dialogs instead of bottom sheets, denser grids (the calendar's
`TimeGrid`/`WeekGrid`), inline buttons instead of sticky bars, hover affordances
permitted as *enhancements* only.

| Width | Nav | Content | Must hold |
|---|---|---|---|
| 320–359 | tab bar | 1 col | No overflow. Smallest supported. |
| 360–639 | tab bar | 1 col | The design width. Check here first, always. |
| 640–767 | tab bar | 2 col | **The gap.** Desktop content, mobile chrome — verify it still reads as one thing. |
| 768–1023 | sidebar | 2 col | Tablet / small laptop. Sheets become dialogs. |
| 1024–1439 | sidebar | 2–3 col | Content caps at `max-w-5xl`. |
| 1440+ | sidebar | 2–3 col | Centred with growing margins — intentional, not a bug. |

Rules:
- **Never ship a change verified at one width only.** Check at least 360, 768
  and 1280, and check 640 whenever you touch a `sm:` class.
- A `sm:` class changes *content*; an `md:` class changes *chrome*. Reach for the
  one that matches what you are actually changing.
- Touch targets stay 44px in the app experience. Hover may add, never carry.
- Mobile-only affordances (sticky action bars, bottom sheets, FAB-style bars)
  are `sm:hidden` or `md:hidden` and must have a pointer-friendly equivalent
  above the breakpoint — not simply vanish.

## Conventions
- `src/app/(customer)/…`, `src/app/(business)/…`, `src/app/(auth)/…`
- Server Actions for mutations; Supabase client only in server code
  (`src/lib/supabase/server.ts`). The browser client is auth-only.
- Migrations in `supabase/migrations/`, never edit the DB by hand.
- Run `npm run lint && npm run typecheck && npm test` before declaring a task
  done.

## Commands
npm run dev | npm run build | npm run lint | npm run typecheck | npm test | supabase db push

## How we work — org structure

Bookly is run as a company. The user is the **Board of Directors** and holds final
authority. Agent definitions live in `.claude/agents/`.

```
BOARD OF DIRECTORS  ← the user. Final authority.
└── CEO  (ceo)
    ├── Engineering Lead / CTO  (eng-lead)
    │     ├── Scheduling Domain Engineer      (eng-scheduling)
    │     ├── Database & Security Engineer    (eng-database)
    │     ├── Frontend Engineer, mobile-first (eng-frontend)
    │     ├── Server Actions Engineer         (eng-actions)
    │     └── Platform & Integrations Engineer(eng-platform)
    ├── QA Lead  (qa-lead)
    │     ├── QA Frontend (qa-frontend)
    │     ├── QA Backend  (qa-backend)
    │     └── QA DevOps   (qa-devops)
    ├── Copy Lead  (copy-lead)
    │     ├── Product/UX Writer      (copy-product)
    │     ├── Marketing Copywriter   (copy-marketing)
    │     └── Lifecycle Writer       (copy-lifecycle)
    ├── Design Lead, UX/UI  (design-lead)
    ├── Marketing Lead / CMO  (mktg-lead)
    │     ├── Growth & SEO    (mktg-growth)
    │     ├── Brand & Design  (mktg-brand)
    │     └── Analytics       (mktg-analytics)
    └── Customer Advocate Lead  (cx-lead)
          ├── "Shop Owner" persona       (cx-owner)
          ├── "Booking Customer" persona (cx-booker)
          └── "First-timer" persona      (cx-firsttimer)
```

### Chain of command
- **Only the CEO reports to the Board.** Leads report to the CEO; individual contributors
  report to their lead. One synthesized voice goes up.
- The CEO delegates through leads, never straight to an individual contributor.
- The CEO never writes code, copy or migrations.

### Who owns the interface
Three roles touch the UI and must not collide: **`design-lead`** owns flows, interaction
patterns, information architecture and state design; **`mktg-brand`** owns visual identity
and the token palette; **`eng-frontend`** owns implementation; **`copy-product`** owns the
words. Design proposes and specifies — it does not edit `.tsx`.

### CEO briefing cadence
Proactively at **session start** (what shipped, what's in flight, what's blocked, what's
recommended), at **milestone/sprint boundaries**, and on **blockers or risk** — plus on
demand whenever the Board asks.

### Escalation gates — the CEO must stop and ask the Board
1. **Scope & priority** — adding, cutting or reordering features.
2. **New dependencies & cost** — any npm package, paid service or infra spend.
3. **Schema & data-loss risk** — migrations, RLS changes, anything irreversible.
4. **Public-facing launches** — publishing copy, deploying to production.

### Definition of done
No work is "done" without a **QA PASS**. If any QA specialist returns FAIL, the verdict is
FAIL. `npm run lint && npm run typecheck && npm test` must pass and be reported honestly.
