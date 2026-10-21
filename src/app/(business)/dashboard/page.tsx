import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CircleDollarSign,
  PartyPopper,
  Rocket,
  Scissors,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { OwnerBookingRow } from "@/components/business/booking-row";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { getOwnerContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  businessToday,
  formatInBusinessTz,
  formatMoney,
  zonedDayMinutesToUtc,
} from "@/lib/booking/time";
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

  const [{ data: todays }, { data: upcoming }, { count: serviceCount }] = await Promise.all([
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
  ]);

  const bookings = todays ?? [];
  const live = bookings.filter((b) => b.status === "pending" || b.status === "confirmed");
  const pending = bookings.filter((b) => b.status === "pending");
  const expected = live.reduce((sum, b) => sum + Number(b.price), 0);

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
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link href="/dashboard/calendar">
              {t(locale, "today.openCalendar")}
              <ArrowRight />
            </Link>
          </Button>
        }
      />

      {welcome ? (
        <Alert tone="success" title={t(locale, "today.setupCompleteTitle")} className="mb-5">
          {t(locale, "today.setupCompleteBody")}
        </Alert>
      ) : null}

      {/* Nudges that unblock a shop before it can take a single booking. */}
      {!serviceCount ? (
        <Card className="mb-5 border-accent/30 bg-accent-soft/40">
          <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between sm:pt-5">
            <div className="flex items-start gap-3">
              <Scissors className="mt-0.5 size-5 shrink-0 text-accent" />
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
          </CardContent>
        </Card>
      ) : !business.is_published ? (
        <Card className="mb-5 border-accent/30 bg-accent-soft/40">
          <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between sm:pt-5">
            <div className="flex items-start gap-3">
              <Rocket className="mt-0.5 size-5 shrink-0 text-accent" />
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
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          icon={CalendarCheck}
          label={t(locale, "today.statToday")}
          value={String(live.length)}
          hint={t(locale, "today.statTodayHint")}
        />
        <Stat
          icon={CalendarClock}
          label={t(locale, "today.statToConfirm")}
          value={String(pending.length)}
          hint={
            pending.length === 1
              ? t(locale, "today.statToConfirmHintOne")
              : t(locale, "today.statToConfirmHintMany")
          }
          highlight={pending.length > 0}
        />
        <Stat
          icon={CircleDollarSign}
          label={t(locale, "today.statExpected")}
          value={formatMoney(expected, live[0]?.currency ?? "THB")}
          hint={t(locale, "today.statExpectedHint")}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-fg-subtle">
          {t(locale, "today.todaysSchedule")}
        </h2>

        {bookings.length === 0 ? (
          <EmptyState
            icon={PartyPopper}
            title={t(locale, "today.nothingBookedTodayTitle")}
            description={
              business.is_published
                ? t(locale, "today.nothingBookedPublishedBody")
                : t(locale, "today.nothingBookedUnpublishedBody")
            }
          />
        ) : (
          <div className="space-y-2.5">
            {bookings.map((booking) => (
              <OwnerBookingRow
                key={booking.id}
                booking={booking}
                timezone={business.timezone}
              />
            ))}
          </div>
        )}
      </section>

      {upcoming && upcoming.length > 0 ? (
        <section className="mt-8 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-fg-subtle">
              {t(locale, "today.comingUp")}
            </h2>
            <Link
              href="/dashboard/calendar"
              className="text-sm font-semibold text-accent hover:underline"
            >
              {t(locale, "today.seeAll")}
            </Link>
          </div>
          <div className="space-y-2.5">
            {upcoming.map((booking) => (
              <div key={booking.id} className="space-y-1.5">
                <p className="text-xs font-semibold text-fg-subtle">
                  {formatInBusinessTz(booking.starts_at, business.timezone, "EEEE d MMM", locale)}
                </p>
                <OwnerBookingRow booking={booking} timezone={business.timezone} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </PageContainer>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  highlight,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border bg-surface p-3.5 ${
        highlight ? "border-warning/40 bg-warning-soft/40" : "border-border"
      } ${className ?? ""}`}
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className="mt-1.5 truncate text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      <p className="text-xs text-fg-subtle">{hint}</p>
    </div>
  );
}
