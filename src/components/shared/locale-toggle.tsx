"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

/**
 * Thai/English switch, mounted once in the root layout so it is reachable
 * from every page. `router.refresh()` re-runs server components (the
 * listing page's category label, business names from the DB stay as typed)
 * against the just-written cookie, so a toggle on a server-rendered page
 * takes effect immediately instead of waiting for the next navigation.
 */
export function LocaleToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const router = useRouter();

  const choose = (next: "th" | "en") => {
    if (next === locale) return;
    setLocale(next);
    router.refresh();
  };

  return (
    <div
      role="group"
      aria-label="Language / ภาษา"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5 text-xs font-semibold",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => choose("th")}
        aria-pressed={locale === "th"}
        className={cn(
          "min-h-8 min-w-10 rounded-full px-2.5",
          locale === "th" ? "bg-primary text-primary-fg" : "text-fg-muted hover:text-fg",
        )}
      >
        ไทย
      </button>
      <button
        type="button"
        onClick={() => choose("en")}
        aria-pressed={locale === "en"}
        className={cn(
          "min-h-8 min-w-10 rounded-full px-2.5",
          locale === "en" ? "bg-primary text-primary-fg" : "text-fg-muted hover:text-fg",
        )}
      >
        EN
      </button>
    </div>
  );
}
