import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { AppointmentCard } from "@/components/shared/appointment-card";
import { businessToday, formatInBusinessTz, shiftDateKey } from "@/lib/booking/time";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const tomorrow = shiftDateKey(businessToday("Asia/Bangkok"), 1);
  const dateLabel = formatInBusinessTz(
    new Date(`${tomorrow}T12:00:00Z`),
    "Asia/Bangkok",
    locale === "th" ? "EEEE d MMM" : "EEE d MMM",
    locale,
  );

  return (
    // md+: the root layout's locale bar (~3.25rem) sits above this page, so the
    // grid takes the rest of the viewport and never scrolls by the bar's height.
    <div className="flex min-h-dvh flex-col bg-bg md:grid md:min-h-[calc(100dvh-3.5rem)] md:grid-cols-2">
      <div className="flex flex-1 flex-col">
        <header className="pt-safe">
          <div className="mx-auto flex h-16 w-full max-w-md items-center justify-between px-4">
            <Link
              href="/"
              className="inline-flex h-11 items-center gap-1.5 -ml-2 px-2 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
            >
              <ArrowLeft className="size-4" />
              {t(locale, "common.back")}
            </Link>
            <Logo showWordmark={false} />
          </div>
        </header>

        {/* Centred on tablet and desktop; top-aligned on a phone so the form is
            not pushed under the keyboard when it opens. */}
        <main className="flex flex-1 flex-col px-4 pb-10 sm:justify-center">
          <div className="mx-auto w-full max-w-md">{children}</div>
        </main>
      </div>

      {/* Desktop only: a brass panel with a filled, stamped appointment card —
          what signing in gets you. Pinned to the full right half (top edge
          included, under the locale bar) so it never starts part-way down. */}
      <aside
        aria-hidden
        className="hidden bg-field-brass text-field-brass-ink md:fixed md:inset-y-0 md:right-0 md:flex md:w-1/2 md:flex-col md:items-center md:justify-center md:px-10 md:py-16"
      >
        <div className="w-full max-w-[420px]">
          <div className="-rotate-2">
            <AppointmentCard
              mode="booked"
              shopName="Nong Barber"
              serviceName="Men's cut"
              dateLabel={dateLabel}
              time={locale === "th" ? "11:00" : "11:00 AM"}
              stamp={t(locale, "myBookings.stampBooked")}
            />
          </div>
          <p className="display mt-10 text-2xl" style={{ fontWeight: 500 }}>
            {t(locale, "auth.panelLine")}
          </p>
          <p className="mt-2 text-sm text-field-brass-muted">{t(locale, "auth.panelCaption")}</p>
        </div>
      </aside>
    </div>
  );
}
