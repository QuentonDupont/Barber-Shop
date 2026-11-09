import Link from "next/link";
import { t, type Locale } from "@/lib/i18n/dictionaries";

/** The brass close: the clock-and-scissors mark at scale beside the name. */
export function LandingClose({ locale }: { locale: Locale }) {
  return (
    <footer className="overflow-hidden bg-field-brass text-field-brass-ink">
      <div className="mx-auto max-w-[1360px] px-[clamp(16px,3vw,40px)] pt-20 pb-safe lg:pt-28">
        <div className="flex items-center gap-[clamp(16px,3vw,48px)]">
          <svg
            viewBox="0 0 64 64"
            aria-hidden
            className="size-[clamp(72px,14vw,160px)] shrink-0"
          >
            <circle cx="32" cy="32" r="21" fill="none" stroke="hsl(var(--field-brass-ink))" strokeWidth="5" />
            <g stroke="hsl(var(--field-ink-fg))" strokeWidth="7" strokeLinecap="round">
              <line x1="32" y1="32" x2="16.4" y2="23" />
              <line x1="32" y1="32" x2="47.6" y2="23" />
            </g>
            <circle cx="32" cy="32" r="3.5" fill="hsl(var(--field-brass-ink))" />
          </svg>
          <p
            aria-hidden
            lang="th"
            className="display whitespace-nowrap text-[clamp(4.5rem,19vw,17rem)]"
            style={{ lineHeight: 1.1 }}
          >
            ตัดนัด
          </p>
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-1 pb-6 text-sm font-medium">
          <Link href="/about" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            {t(locale, "about.navAbout")}
          </Link>
          <Link href="/privacy" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            {t(locale, "landing.footerPrivacy")}
          </Link>
          <span className="inline-flex min-h-11 items-center">© {new Date().getFullYear()} TatNat</span>
        </div>
      </div>
    </footer>
  );
}
