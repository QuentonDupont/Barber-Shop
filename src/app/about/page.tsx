import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { LandingClose } from "@/components/landing/close";
import {
  AboutClosing,
  AboutCustomers,
  AboutFaq,
  AboutHero,
  AboutOwners,
  AboutPlans,
} from "@/components/about/about-sections";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isMockMode } from "@/lib/mock/config";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: t(locale, "about.metaTitle"),
    description: t(locale, "about.metaDescription"),
  };
}

/** Public About page (decision #24). No login, no data layer beyond the optional session for the header button. */
export default async function AboutPage() {
  const locale = await getLocale();
  const configured = isSupabaseConfigured() || isMockMode();
  const session = configured ? await getSession().catch(() => null) : null;
  const signedInHome = session?.profile.role === "business_owner" ? "/dashboard" : "/app";

  return (
    <div className="min-h-dvh bg-bg">
      <header className="pt-safe">
        <div className="mx-auto flex h-[72px] max-w-[1360px] items-center justify-between gap-3 px-[clamp(16px,3vw,40px)]">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-2">
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
      </header>
      <main>
        <AboutHero locale={locale} />
        <AboutCustomers locale={locale} />
        <AboutOwners locale={locale} />
        <AboutPlans locale={locale} />
        <AboutFaq locale={locale} />
        <AboutClosing locale={locale} />
      </main>
      <LandingClose locale={locale} />
    </div>
  );
}
