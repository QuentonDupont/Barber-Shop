import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AppointmentCard, type DemoShop } from "@/components/shared/appointment-card";
import { t, type Locale } from "@/lib/i18n/dictionaries";

/**
 * Brass field, two-line hand-lettered headline, and the live appointment
 * card: the visitor sees a real free time and can tap it straight away.
 */
export function LandingHero({
  locale,
  shops,
  live,
}: {
  locale: Locale;
  shops: DemoShop[];
  live: boolean;
}) {
  return (
    <section className="bg-field-brass text-field-brass-ink">
      <div className="mx-auto grid max-w-[1360px] gap-8 px-[clamp(16px,3vw,40px)] pt-10 pb-16 sm:pt-14 lg:grid-cols-12 lg:items-center lg:gap-10 lg:pt-[72px] lg:pb-24">
        <div className="lg:col-span-7">
          <h1 className="display land-headline text-[44px] sm:text-[clamp(2.75rem,1rem+6.2vw,6rem)] lg:[&_.land-line>span]:whitespace-nowrap">
            <span className="land-line">
              <span>{t(locale, "landing.headlineLine1")}</span>
            </span>
            <span className="land-line">
              <span>{t(locale, "landing.headlineLine2")}</span>
            </span>
          </h1>
          <p className="mt-6 max-w-[38ch] text-pretty text-[clamp(1.125rem,1rem+0.55vw,1.4rem)] leading-[1.5] text-field-brass-muted sm:mt-8 [&:lang(th)]:leading-[1.7]">
            {t(locale, "landing.intro")}
          </p>
          <div className="mt-8 flex flex-col gap-2 sm:mt-10 sm:flex-row sm:items-center sm:gap-6">
            <Button
              asChild
              size="lg"
              variant="primary"
              // Ink on brass in both themes (the app's primary inverts at night).
              className="w-full bg-field-brass-ink text-field-ink-fg hover:bg-field-brass-ink/90 sm:w-auto"
            >
              <Link href="/sign-up?role=customer">{t(locale, "landing.createAccount")}</Link>
            </Button>
            <Link
              href="/sign-in?role=customer"
              className="inline-flex min-h-11 items-center justify-center text-base font-semibold underline underline-offset-4"
            >
              {t(locale, "landing.haveOne")}
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5 lg:flex lg:justify-end">
          <div className="w-full max-w-[520px] lg:max-w-[460px]">
            <div className="land-card">
              <AppointmentCard mode="demo" shops={shops} />
            </div>
            <p className="mt-4 text-sm text-field-brass-muted">
              {t(locale, live ? "landing.cardCaptionLive" : "landing.cardCaptionSample")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
