import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatInBusinessTz, zonedDayMinutesToUtc } from "@/lib/booking/time";
import { computeWeeklyMetrics, WEEKLY_ACTIVE_THRESHOLD, windowStartKey } from "@/lib/metrics/weekly";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Weekly numbers" };

const WEEKS = 8;

/**
 * Owner-facing weekly numbers (beta ops, handoff 10): bookings, who made
 * them, no-shows, and whether the week counts as "active" for the beta gate.
 * Read through the owner's own session, so row-level security still scopes
 * every number to this one shop.
 */
export default async function NumbersPage() {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const locale = await getLocale();
  const tz = ctx.business.timezone;

  const from = zonedDayMinutesToUtc(windowStartKey(tz, WEEKS), 0, tz);
  const { data } = await supabase
    .from("bookings")
    .select("starts_at, status, source")
    .eq("business_id", ctx.business.id)
    .gte("starts_at", from.toISOString());

  const weeks = computeWeeklyMetrics(data ?? [], tz, { weeks: WEEKS });
  const hasAny = weeks.some((w) => w.bookingsTotal + w.cancelled > 0);

  return (
    <PageContainer>
      <PageHeader
        title={t(locale, "numbers.title")}
        description={t(locale, "numbers.subtitle")}
      />

      {!hasAny ? (
        <EmptyState title={t(locale, "numbers.empty")} />
      ) : (
        <div className="space-y-3" data-testid="numbers-weeks">
          {weeks.map((w, i) => (
            <Card key={w.weekStart} data-testid="numbers-week-row" data-week-start={w.weekStart}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {i === 0 ? `${t(locale, "numbers.thisWeek")} · ` : ""}
                    {t(locale, "numbers.weekOf", {
                      date: formatInBusinessTz(`${w.weekStart}T12:00:00Z`, "UTC", "d MMM", locale),
                    })}
                  </p>
                  <Badge
                    tone={w.isWeeklyActive ? "success" : "neutral"}
                    data-testid="numbers-active-badge"
                    data-active={w.isWeeklyActive ? "true" : "false"}
                  >
                    {t(locale, w.isWeeklyActive ? "numbers.activeYes" : "numbers.activeNo")}
                  </Badge>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                  <Stat label={t(locale, "numbers.bookings")} value={w.bookingsTotal} testId="numbers-bookings" />
                  <Stat label={t(locale, "numbers.customerBooked")} value={w.customerBooked} testId="numbers-customer-booked" />
                  <Stat label={t(locale, "numbers.shopEntered")} value={w.shopEntered} testId="numbers-shop-entered" />
                  <Stat label={t(locale, "numbers.completed")} value={w.completed} testId="numbers-completed" />
                  <Stat label={t(locale, "numbers.noShows")} value={w.noShows} testId="numbers-no-shows" />
                  <Stat label={t(locale, "numbers.cancelled")} value={w.cancelled} testId="numbers-cancelled" />
                  <Stat
                    label={t(locale, "numbers.noShowRate")}
                    value={w.noShowRate === null ? t(locale, "numbers.noShowRateNone") : `${Math.round(w.noShowRate * 100)}%`}
                    testId="numbers-no-show-rate"
                  />
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-1 text-xs text-fg-subtle">
        <p>{t(locale, "numbers.activeRule", { n: WEEKLY_ACTIVE_THRESHOLD })}</p>
        <p>{t(locale, "numbers.rateRule")}</p>
      </div>
    </PageContainer>
  );
}

function Stat({ label, value, testId }: { label: string; value: number | string; testId: string }) {
  return (
    <div>
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-base font-bold tabular-nums" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}
