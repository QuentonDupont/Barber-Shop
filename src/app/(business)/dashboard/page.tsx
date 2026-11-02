import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Rocket, Scissors } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { OwnerBookingRow } from "@/components/business/booking-row";
import { AddBookingSheet } from "@/components/business/add-booking-sheet";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getOwnerContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  businessToday,
  formatInBusinessTz,
  formatMoney,
  formatSlotTime,
  localMinutesFromMidnight,
  parseTimeToMinutes,
  weekdayOf,
  zonedDayMinutesToUtc,
} from "@/lib/booking/time";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Today" };

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const ctx = await getOwnerContext();
  const locale = await getLocale();

  if (!ctx.business) redirect("/dashboard/onboarding");
  if (ctx.business.onboarding_step < 3) redirect("/dashboard/onboarding");

  const business = ctx.business;
  const supabase = await createClient();
  const today = businessToday(business.timezone);

  const dayStart = zonedDayMinutesToUtc(today, 0, business.timezone);
  const dayEnd = zonedDayMinutesToUtc(today, 1440, business.timezone);

  const [
    { data: todays },
    { data: upcoming },
    { count: serviceCount },
    { data: services },
    { data: staff },
    { data: hoursToday },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("*")
      .eq("business_id", business.id)
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", dayEnd.toISOString())
      .order("starts_at", { ascending: true }),
    supabase
      .from("bookings")
      .select("*")
      .eq("business_id", business.id)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", dayEnd.toISOString())
      .order("starts_at", { ascending: true })
      .limit(5),
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("is_active", true),
    supabase
      .from("services")
      .select("id, name, duration_min, price, currency")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("staff")
      .select("id, name")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("business_hours")
      .select("open_time, close_time, is_closed")
      .eq("business_id", business.id)
      .eq("weekday", weekdayOf(today))
      .maybeSingle(),
  ]);

  const bookings = todays ?? [];
  const live = bookings.filter((b) => b.status === "pending" || b.status === "confirmed");
  const pending = bookings.filter((b) => b.status === "pending");
  const expected = live.reduce((sum, b) => sum + Number(b.price), 0);

  // The "now" line sits after the last booking that has already started.
  const now = new Date();
  const nowMinute = localMinutesFromMidnight(now, business.timezone, today);
  const nowIndex = bookings.filter((b) => new Date(b.starts_at) <= now).length;
  const nowLabel = t(locale, "today.nowLabel", {
    time: formatSlotTime(now, business.timezone, locale),
  });

  // Coming up, grouped into one panel per day.
  const upcomingByDay: { label: string; rows: NonNullable<typeof upcoming> }[] = [];
  for (const booking of upcoming ?? []) {
    const label = formatInBusinessTz(booking.starts_at, business.timezone, "EEEE d MMM", locale);
    const group = upcomingByDay.at(-1);
    if (group && group.label === label) group.rows.push(booking);
    else upcomingByDay.push({ label, rows: [booking] });
  }

  const open =
    hoursToday && !hoursToday.is_closed && hoursToday.open_time && hoursToday.close_time
      ? {
          start: parseTimeToMinutes(hoursToday.open_time),
          end: parseTimeToMinutes(hoursToday.close_time),
        }
      : null;

  return (
    <PageContainer>
      <PageHeader
        title={t(locale, "today.titleWithDate", {
          date: formatInBusinessTz(new Date(), business.timezone, "d MMMM", locale),
        })}
        description={t(locale, "today.description", {
          name: business.name,
          timezone: business.timezone,
        })}
        action={
          <div className="flex items-center gap-2">
            <AddBookingSheet services={services ?? []} staff={staff ?? []} today={today} />
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/dashboard/calendar">
                {t(locale, "today.openCalendar")}
                <ArrowRight />
              </Link>
            </Button>
          </div>
        }
      />

      {welcome ? (
        <Alert tone="success" title={t(locale, "today.setupCompleteTitle")} className="mb-5">
          {t(locale, "today.setupCompleteBody")}
        </Alert>
      ) : null}

      {/* Nudges that unblock a shop before it can take a single booking. */}
      {!serviceCount ? (
        <div className="mb-5 flex flex-col gap-3 rounded-[var(--radius-panel)] bg-accent-soft p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Scissors className="mt-0.5 size-5 shrink-0 text-accent-ink" />
              <div>
                <p className="font-semibold">{t(locale, "today.addFirstServiceTitle")}</p>
                <p className="text-sm text-fg-muted text-pretty">
                  {t(locale, "today.addFirstServiceBody")}
                </p>
              </div>
            </div>
            <Button asChild variant="accent" size="md" className="shrink-0">
              <Link href="/dashboard/services">{t(locale, "today.addAService")}</Link>
            </Button>
        </div>
      ) : !business.is_published ? (
        <div className="mb-5 flex flex-col gap-3 rounded-[var(--radius-panel)] bg-accent-soft p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Rocket className="mt-0.5 size-5 shrink-0 text-accent-ink" />
              <div>
                <p className="font-semibold">{t(locale, "today.notLiveTitle")}</p>
                <p className="text-sm text-fg-muted text-pretty">
                  {t(locale, "today.notLiveBody")}
                </p>
              </div>
            </div>
            <Button asChild variant="accent" size="md" className="shrink-0">
              <Link href="/dashboard/settings">{t(locale, "today.goLive")}</Link>
            </Button>
        </div>
      ) : null}

      {/* One divided strip, not three cards: KPIs are type, not tiles. */}
      <div className="mb-8 grid grid-cols-2 overflow-clip rounded-[var(--radius-panel)] border border-border bg-surface sm:grid-cols-3">
        <Stat
          label={t(locale, "today.statToday")}
          value={String(live.length)}
          hint={t(locale, "today.statTodayHint")}
        />
        <Stat
          label={t(locale, "today.statToConfirm")}
          value={String(pending.length)}
          hint={
            pending.length === 1
              ? t(locale, "today.statToConfirmHintOne")
              : t(locale, "today.statToConfirmHintMany")
          }
          warn={pending.length > 0}
          link={
            pending[0]
              ? { href: `#booking-${pending[0].id}`, label: t(locale, "today.seeRequests") }
              : undefined
          }
          className="border-l border-border"
        />
        <Stat
          label={t(locale, "today.statExpected")}
          value={formatMoney(expected, live[0]?.currency ?? "THB")}
          hint={t(locale, "today.statExpectedHint")}
          className="col-span-2 border-t border-border sm:col-span-1 sm:border-t-0 sm:border-l"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-[17px] font-semibold">{t(locale, "today.todaysSchedule")}</h2>

        {bookings.length === 0 ? (
          <div className="rounded-[var(--radius-panel)] border border-border bg-surface px-5 py-8">
            {open ? (
              <div className="mb-6" aria-hidden>
                <div className="relative h-10 rounded-full bg-surface-muted">
                  {nowMinute > open.start && nowMinute < open.end ? (
                    <span
                      className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
                      style={{ left: `${((nowMinute - open.start) / (open.end - open.start)) * 100}%` }}
                    />
                  ) : null}
                </div>
                <div className="num mt-1.5 flex justify-between text-[13px] text-fg-muted">
                  <span>{hoursToday?.open_time?.slice(0, 5)}</span>
                  <span>{hoursToday?.close_time?.slice(0, 5)}</span>
                </div>
              </div>
            ) : null}
            <p className="text-center text-base font-semibold">
              {t(locale, "today.nothingBookedTodayTitle")}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-center text-sm text-fg-muted text-pretty">
              {business.is_published
                ? t(locale, "today.nothingBookedPublishedBody")
                : t(locale, "today.nothingBookedUnpublishedBody")}
            </p>
          </div>
        ) : (
          <ul className="overflow-clip rounded-[var(--radius-panel)] border border-border bg-surface">
            {bookings.map((booking, index) => (
              <li
                key={booking.id}
                id={`booking-${booking.id}`}
                className={cn("relative scroll-mt-24", index > 0 && "border-t border-border")}
              >
                {index === nowIndex && index > 0 ? <NowLine label={nowLabel} /> : null}
                <OwnerBookingRow
                  booking={booking}
                  timezone={business.timezone}
                  framed={false}
                  className={new Date(booking.ends_at) <= now ? "text-fg-muted" : undefined}
                />
              </li>
            ))}
            {nowIndex === bookings.length && nowMinute < 1440 ? (
              <li aria-hidden className="relative">
                <NowLine label={nowLabel} />
              </li>
            ) : null}
          </ul>
        )}
      </section>

      {upcomingByDay.length > 0 ? (
        <section className="mt-10 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">{t(locale, "today.comingUp")}</h2>
            <Link
              href="/dashboard/calendar"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-ink underline-offset-4 hover:underline"
            >
              {t(locale, "today.seeAll")}
            </Link>
          </div>
          <div className="space-y-3">
            {upcomingByDay.map((group) => (
              <div
                key={group.label}
                className="overflow-clip rounded-[var(--radius-panel)] border border-border bg-surface"
              >
                <p className="px-4 pt-3 text-[13px] font-semibold text-fg-muted">{group.label}</p>
                <ul>
                  {group.rows.map((booking, index) => (
                    <li key={booking.id} className={cn(index > 0 && "border-t border-border")}>
                      <OwnerBookingRow booking={booking} timezone={business.timezone} framed={false} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </PageContainer>
  );
}

/** The brass "now" rule across the schedule panel, with the time. */
function NowLine({ label }: { label: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-px z-10 h-0">
      <div className="h-0.5 bg-accent" />
      <span className="absolute -top-[3px] left-3 size-2 rounded-full bg-accent" />
      <span className="num absolute -top-5 right-4 rounded-full bg-surface px-1.5 text-xs font-semibold text-accent-ink">
        {label}
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  warn,
  link,
  className,
}: {
  label: string;
  value: string;
  hint: string;
  warn?: boolean;
  link?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 p-5", className)}>
      <p className="text-[13px] font-medium text-fg-muted">{label}</p>
      <p className={cn("num mt-1 truncate text-[28px] font-semibold leading-tight", warn && "text-warning")}>
        {value}
      </p>
      <p className="text-[13px] text-fg-subtle">
        {hint}
        {link ? (
          <>
            {" · "}
            <a href={link.href} className="font-semibold text-accent-ink underline underline-offset-4">
              {link.label}
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}
