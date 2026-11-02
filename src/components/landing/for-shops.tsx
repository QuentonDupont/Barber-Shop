import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/landing/reveal";
import { BETA_INVITE_HREF } from "@/lib/beta";
import { businessToday, formatInBusinessTz, formatMoney } from "@/lib/booking/time";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/** The demo shop's day, as its owner sees it on "Today" (fixture data). */
const ROWS = [
  { time: "10:15", end: "10:45", service: "Hot-towel shave", customer: "Somchai Prasert", staff: "Nong", status: "confirmed" as const },
  { time: "14:30", end: "16:00", service: "Cut & beard", customer: "Malee Thongdee", staff: "Ploy", status: "confirmed" as const },
  { time: "17:00", end: "17:45", service: "Men's cut", customer: "Anucha Kitti", staff: "Nong", status: "pending" as const },
];

function en12(time: string) {
  const [h, m] = time.split(":").map(Number);
  return { clock: `${h! % 12 === 0 ? 12 : h! % 12}:${String(m).padStart(2, "0")}`, ampm: h! < 12 ? "AM" : "PM" };
}

function TodayFragment({ locale }: { locale: Locale }) {
  const th = locale === "th";
  const date = formatInBusinessTz(
    new Date(`${businessToday("Asia/Bangkok")}T12:00:00Z`),
    "Asia/Bangkok",
    th ? "EEEE d MMMM" : "EEEE d MMMM",
    locale,
  );
  const stats = [
    { label: t(locale, "today.statToday"), value: "3", hint: t(locale, "today.statTodayHint") },
    { label: t(locale, "today.statToConfirm"), value: "1", hint: t(locale, "today.statToConfirmHintOne"), warn: true },
    { label: t(locale, "today.statExpected"), value: formatMoney(1500), hint: t(locale, "today.statExpectedHint"), wide: true },
  ];
  const now = th ? "13:05" : "1:05 PM";

  return (
    <div
      data-ui
      role="img"
      aria-label={t(locale, "landing.bizFragmentLabel")}
      className="rounded-[var(--radius-panel)] border border-border bg-bg p-4 text-fg sm:p-6"
    >
      <div aria-hidden>
        <p className="text-xl font-semibold sm:text-2xl">{t(locale, "today.titleWithDate", { date })}</p>
        <p className="mt-1 text-[13px] text-fg-muted">Nong Barber</p>

        <div className="mt-4 grid grid-cols-2 overflow-clip rounded-[var(--radius-panel)] border border-border bg-surface sm:grid-cols-3">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={cn(
                "p-4",
                stat.wide ? "col-span-2 border-t border-border sm:col-span-1 sm:border-t-0 sm:border-l" : "",
                i === 1 ? "border-l border-border" : "",
              )}
            >
              <p className="text-[13px] font-medium text-fg-muted">{stat.label}</p>
              <p className={cn("num mt-1 text-2xl font-semibold", stat.warn && "text-warning")}>{stat.value}</p>
              <p className="text-[13px] text-fg-subtle">{stat.hint}</p>
            </div>
          ))}
        </div>

        <ul className="mt-4 overflow-clip rounded-[var(--radius-panel)] border border-border bg-surface">
          {ROWS.map((row, i) => {
            const clock = th ? { clock: row.time, ampm: "" } : en12(row.time);
            return (
              <li key={row.time} className="rv-row relative" style={{ "--i": i } as React.CSSProperties}>
                {i === 1 ? (
                  <div className="relative h-0">
                    <div className="absolute inset-x-0 -top-px h-0.5 bg-accent" />
                    <span className="absolute -top-1 left-[60px] size-2 rounded-full bg-accent" />
                    <span className="num absolute -top-5 right-3 text-xs font-semibold text-accent-ink">
                      {t(locale, "today.nowLabel", { time: now })}
                    </span>
                  </div>
                ) : null}
                <div className={cn("flex min-h-[72px] gap-3 px-4 py-3.5", i > 0 && "border-t border-border")}>
                  <div className={cn("w-16 shrink-0", i === 0 && "text-fg-muted")}>
                    <p className="num text-[17px] font-semibold">{clock.clock}</p>
                    {clock.ampm ? <p className="text-xs text-fg-muted">{clock.ampm}</p> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-[15px] font-semibold", i === 0 && "text-fg-muted")}>{row.service}</p>
                    <p className="truncate text-sm text-fg-muted">
                      {row.customer} · {row.staff}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge tone={row.status === "confirmed" ? "success" : "warning"}>
                        {t(locale, row.status === "confirmed" ? "status.confirmed" : "status.pending")}
                      </Badge>
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function ForShops({ locale }: { locale: Locale }) {
  return (
    <section
      id="for-shops"
      aria-labelledby="for-shops-title"
      className="scroll-mt-4 bg-field-ink text-field-ink-fg"
    >
      <Reveal className="mx-auto grid max-w-[1360px] gap-12 px-[clamp(16px,3vw,40px)] py-[88px] lg:grid-cols-12 lg:gap-10 lg:py-40">
        <div className="lg:col-span-5">
          <h2
            id="for-shops-title"
            className="display rv text-[clamp(2rem,1.2rem+2.8vw,3.75rem)] [&:lang(en)]:leading-[1.05] [&:lang(th)]:leading-[1.22]"
          >
            {t(locale, "landing.bizTitle")}
          </h2>
          <p
            className="rv mt-5 max-w-[46ch] text-pretty text-lg leading-[1.55] text-field-ink-muted [&:lang(th)]:leading-[1.7]"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            {t(locale, "landing.bizDesc")}
          </p>
          <ul className="rv mt-8 space-y-3 text-[17px]" style={{ "--i": 2 } as React.CSSProperties}>
            <li>{t(locale, "landing.bizPoint1")}</li>
            <li>{t(locale, "landing.bizPoint2")}</li>
            <li>{t(locale, "landing.bizPoint3")}</li>
          </ul>
          <div className="rv mt-10" style={{ "--i": 3 } as React.CSSProperties}>
            <p className="max-w-[46ch] text-sm text-field-ink-muted">{t(locale, "landing.bizInviteNote")}</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
              <Button asChild size="lg" variant="accent" className="w-full sm:w-auto">
                <a href={BETA_INVITE_HREF}>{t(locale, "landing.requestInvite")}</a>
              </Button>
              <Link
                href="/sign-in?role=business_owner"
                className="inline-flex min-h-11 items-center justify-center text-base font-semibold underline underline-offset-4"
              >
                {t(locale, "landing.haveOne")}
              </Link>
            </div>
          </div>
        </div>

        <div className="rv lg:col-span-6 lg:col-start-7" style={{ "--i": 2 } as React.CSSProperties}>
          <TodayFragment locale={locale} />
        </div>
      </Reveal>
    </section>
  );
}
