import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Clock3,
  MapPin,
  Scissors,
  Smartphone,
  Store,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { SetupNotice } from "@/components/shared/setup-notice";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isMockMode } from "@/lib/mock/config";
import { BETA_INVITE_HREF } from "@/lib/beta";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

export default async function LandingPage() {
  const locale = await getLocale();
  const configured = isSupabaseConfigured() || isMockMode();
  const session = configured ? await getSession().catch(() => null) : null;
  const signedInHome =
    session?.profile.role === "business_owner" ? "/dashboard" : "/app";

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/85 backdrop-blur-md pt-safe">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          {session ? (
            <Button asChild size="sm" variant="primary">
              <Link href={signedInHome}>
                {t(locale, "landing.openApp")}
                <ArrowRight />
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="ghost">
              <Link href="/sign-in">{t(locale, "landing.signIn")}</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        {!configured ? <SetupNotice className="mt-6" /> : null}

        {/* ---- Hero ------------------------------------------------------ */}
        <section className="pt-10 pb-4 sm:pt-16 sm:pb-8">
          <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent">
            <Clock3 className="size-3.5" />
            {t(locale, "landing.badge")}
          </p>
          <h1 className="mt-4 text-balance text-[2rem] font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            {t(locale, "landing.headlineStart")}{" "}
            <span className="text-accent">{t(locale, "landing.headlineAccent")}</span>
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-fg-muted sm:text-lg">
            {t(locale, "landing.intro")}
          </p>
        </section>

        {/* ---- The two doors --------------------------------------------
            The whole product forks here, so the choice gets the full width of
            a phone screen rather than being buried in a nav menu. ---------- */}
        <section aria-labelledby="choose-portal" className="mt-4 sm:mt-8">
          <h2 id="choose-portal" className="sr-only">
            {t(locale, "landing.chooseSr")}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
            <PortalCard
              href="/sign-up?role=customer"
              signInHref="/sign-in?role=customer"
              locale={locale}
              eyebrow={t(locale, "landing.custEyebrow")}
              title={t(locale, "landing.custTitle")}
              description={t(locale, "landing.custDesc")}
              icon={Users}
              tone="accent"
              points={[
                { icon: MapPin, text: t(locale, "landing.custPoint1") },
                { icon: CalendarCheck, text: t(locale, "landing.custPoint2") },
                { icon: Smartphone, text: t(locale, "landing.custPoint3") },
              ]}
            />

            <PortalCard
              href={BETA_INVITE_HREF}
              ctaLabel={t(locale, "landing.requestInvite")}
              signInHref="/sign-in?role=business_owner"
              locale={locale}
              eyebrow={t(locale, "landing.bizEyebrow")}
              title={t(locale, "landing.bizTitle")}
              description={t(locale, "landing.bizDesc")}
              icon={Store}
              tone="primary"
              points={[
                { icon: Clock3, text: t(locale, "landing.bizPoint1") },
                { icon: Scissors, text: t(locale, "landing.bizPoint2") },
                { icon: CalendarCheck, text: t(locale, "landing.bizPoint3") },
              ]}
            />
          </div>
        </section>

        {/* ---- Reassurance ------------------------------------------------ */}
        <section className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-3">
          {[
            {
              title: t(locale, "landing.r1Title"),
              body: t(locale, "landing.r1Body"),
            },
            {
              title: t(locale, "landing.r2Title"),
              body: t(locale, "landing.r2Body"),
            },
            {
              title: t(locale, "landing.r3Title"),
              body: t(locale, "landing.r3Body"),
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]"
            >
              <h3 className="font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted text-pretty">
                {item.body}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-8 pb-safe">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-sm text-fg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p>© {new Date().getFullYear()} TatNat</p>
        </div>
      </footer>
    </div>
  );
}

function PortalCard({
  href,
  ctaLabel,
  locale,
  signInHref,
  eyebrow,
  title,
  description,
  icon: Icon,
  tone,
  points,
}: {
  href: string;
  ctaLabel?: string;
  locale: Locale;
  signInHref: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "accent" | "primary";
  points: { icon: React.ComponentType<{ className?: string }>; text: string }[];
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex items-center gap-3">
        <span
          className={
            tone === "accent"
              ? "flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent"
              : "flex size-11 items-center justify-center rounded-xl bg-primary text-primary-fg"
          }
        >
          <Icon className="size-5.5" />
        </span>
        <p className="text-sm font-semibold text-fg-muted">{eyebrow}</p>
      </div>

      <h3 className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted text-pretty">
        {description}
      </p>

      <ul className="mt-5 space-y-2.5">
        {points.map((point) => (
          <li key={point.text} className="flex items-start gap-2.5 text-sm">
            <point.icon className="mt-0.5 size-4 shrink-0 text-accent" />
            <span className="text-fg-muted">{point.text}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col gap-2 sm:mt-auto sm:pt-6">
        <Button asChild size="lg" block variant={tone === "accent" ? "accent" : "primary"}>
          <Link href={href}>
            {ctaLabel ?? t(locale, "landing.createAccount")}
            <ArrowRight />
          </Link>
        </Button>
        <Button asChild size="md" block variant="ghost">
          <Link href={signInHref}>{t(locale, "landing.haveOne")}</Link>
        </Button>
      </div>
    </div>
  );
}
