import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Offline" };

export default async function OfflinePage() {
  const locale = await getLocale();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo />
      <span className="flex size-16 items-center justify-center rounded-full bg-surface-muted">
        <WifiOff className="size-7 text-fg-subtle" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-xl font-bold tracking-tight">{t(locale, "ui.offlineTitle")}</h1>
        <p className="max-w-sm text-sm text-fg-muted text-pretty">{t(locale, "ui.offlineBody")}</p>
      </div>
    </div>
  );
}
