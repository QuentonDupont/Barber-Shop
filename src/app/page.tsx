import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { SetupNotice } from "@/components/shared/setup-notice";
import type { DemoShop } from "@/components/shared/appointment-card";
import { LandingHero } from "@/components/landing/hero";
import { DayStrip } from "@/components/landing/day-strip";
import { ForShops } from "@/components/landing/for-shops";
import { SmallThings } from "@/components/landing/small-things";
import { LandingClose } from "@/components/landing/close";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isMockMode } from "@/lib/mock/config";
import { createClient } from "@/lib/supabase/server";
import { availabilityForRange, loadAvailabilitySources } from "@/lib/booking/availability";
import type { Slot } from "@/lib/booking/slots";
import {
  businessToday,
  formatInBusinessTz,
  formatMoney,
  formatSlotTime,
  shiftDateKey,
} from "@/lib/booking/time";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

/** At most six times, spread across the day rather than the first six in a
 * row (a 15-minute grid would otherwise show 11:00 11:15 11:30 …). */
function pickTimes(slots: Slot[]): Slot[] {
  const round = slots.filter((slot) => slot.startMinute % 30 === 0);
  const pool = round.length >= 6 ? round : slots;
  if (pool.length <= 6) return pool;
  const step = (pool.length - 1) / 5;
  return Array.from({ length: 6 }, (_, i) => pool[Math.round(i * step)]!);
}

function dateLabel(dateKey: string, timezone: string, locale: Locale): string {
  // Noon keeps the instant safely inside the calendar day in any zone.
  return formatInBusinessTz(
    new Date(`${dateKey}T12:00:00Z`),
    timezone,
    locale === "th" ? "EEEE d MMM" : "EEE d MMM",
    locale,
  );
}

/** Static stand-in when there is no backend (or it fails): two demo shops and
 * plausible free times, captioned as a sample rather than live data. */
function sampleShops(locale: Locale): DemoShop[] {
  const today = businessToday("Asia/Bangkok");
  const th = locale === "th";
  const label = dateLabel(today, "Asia/Bangkok", locale);
  const en = (times: string[]) =>
    times.map((time) => {
      const [h, m] = time.split(":").map(Number);
      const h12 = h! % 12 === 0 ? 12 : h! % 12;
      return `${h12}:${String(m).padStart(2, "0")} ${h! < 12 ? "AM" : "PM"}`;
    });
  const barber = ["11:00", "13:30", "14:00", "15:30", "16:00", "18:30"];
  const spa = ["14:00", "14:30", "15:00", "16:30", "17:00", "19:00"];
  return [
    {
      slug: "nong-barber",
      name: "Nong Barber",
      serviceId: null,
      serviceName: "Men's cut",
      price: formatMoney(350),
      dateKey: today,
      day: "today",
      dateLabel: label,
      times: th ? barber : en(barber),
    },
    {
      slug: "baan-suan-spa",
      name: "Baan Suan Spa",
      serviceId: null,
      serviceName: "Thai massage (60 min)",
      price: formatMoney(600),
      dateKey: today,
      day: "today",
      dateLabel: label,
      times: th ? spa : en(spa),
    },
  ];
}

/**
 * Real free times for the first two published shops, from the same
 * availability engine the shop page uses, so the card's claim is true.
 */
async function loadDemoShops(locale: Locale): Promise<DemoShop[] | null> {
  const supabase = await createClient();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("*")
    .eq("is_published", true)
    .order("created_at", { ascending: true })
    .limit(2);
  if (!businesses || businesses.length === 0) return null;

  const shops: DemoShop[] = [];
  for (const business of businesses) {
    const { data: service } = await supabase
      .from("services")
      .select("*")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!service) continue;

    const today = businessToday(business.timezone);
    const sources = await loadAvailabilitySources(
      supabase,
      business,
      today,
      shiftDateKey(today, 2),
    );
    const days = availabilityForRange(business, service, sources, today, 2);
    const day = days.find((d) => d.slots.length > 0) ?? days[0];
    if (!day) continue;

    shops.push({
      slug: business.slug,
      name: business.name,
      serviceId: service.id,
      serviceName: service.name,
      price: formatMoney(service.price, service.currency),
      dateKey: day.date,
      day: day.date === today ? "today" : "tomorrow",
      dateLabel: dateLabel(day.date, business.timezone, locale),
      times: pickTimes(day.slots).map((slot) =>
        formatSlotTime(slot.startsAt, business.timezone, locale),
      ),
    });
  }
  return shops.length > 0 ? shops : null;
}

export default async function LandingPage() {
  const locale = await getLocale();
  const configured = isSupabaseConfigured() || isMockMode();
  const session = configured ? await getSession().catch(() => null) : null;
  const signedInHome =
    session?.profile.role === "business_owner" ? "/dashboard" : "/app";

  let shops: DemoShop[] | null = null;
  if (configured) {
    try {
      shops = await loadDemoShops(locale);
    } catch {
      shops = null;
    }
  }
  const live = shops !== null;

  return (
    <div className="min-h-dvh bg-bg">
      <header className="pt-safe">
        <div className="mx-auto flex h-[72px] max-w-[1360px] items-center justify-between gap-3 px-[clamp(16px,3vw,40px)]">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-2">
            <a
              href="#for-shops"
              className="hidden min-h-11 items-center rounded-full px-4 text-[15px] font-semibold text-fg hover:underline sm:inline-flex"
            >
              {t(locale, "landing.navForShops")}
            </a>
            <Link
              href="/about"
              className="inline-flex min-h-11 items-center rounded-full px-3 text-[15px] font-semibold text-fg hover:underline sm:px-4"
            >
              {t(locale, "about.navAbout")}
            </Link>
            {session ? (
              <Button asChild size="sm" variant="outline">
                <Link href={signedInHome}>
                  {t(locale, "landing.openApp")}
                  <ArrowRight />
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link href="/sign-in">{t(locale, "landing.signIn")}</Link>
              </Button>
            )}
          </nav>
        </div>
        {!configured ? (
          <div className="mx-auto max-w-[1360px] px-[clamp(16px,3vw,40px)] pb-6">
            <SetupNotice />
          </div>
        ) : null}
      </header>

      <main>
        <LandingHero locale={locale} shops={shops ?? sampleShops(locale)} live={live} />
        <DayStrip locale={locale} />
        <ForShops locale={locale} />
        <SmallThings locale={locale} />
      </main>

      <LandingClose locale={locale} />
    </div>
  );
}
