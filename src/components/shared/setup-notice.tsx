import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

/**
 * Shown when Supabase credentials are missing. Without this the first run of a
 * fresh clone fails with an SDK-level "Invalid URL", which tells a newcomer
 * nothing about what to do next.
 */
export async function SetupNotice({ className }: { className?: string }) {
  const locale = await getLocale();
  return (
    <div
      className={cn(
        "rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm",
        className,
      )}
      role="status"
    >
      <p className="flex items-center gap-2 font-semibold text-warning">
        <TriangleAlert className="size-4 shrink-0" />
        {t(locale, "ui.setupTitle")}
      </p>
      <p className="mt-2 text-fg-muted text-pretty">{t(locale, "ui.setupBody")}</p>
    </div>
  );
}
