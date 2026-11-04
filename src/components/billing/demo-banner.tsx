"use client";

import { FlaskConical } from "lucide-react";
import { useT } from "@/lib/i18n/context";

/**
 * Shown on every screen where money appears. Billing runs on a mock provider
 * only (decision 25): the banner says so in plain words, Thai first.
 */
export function DemoBanner({ compact = false }: { compact?: boolean }) {
  const t = useT();
  return (
    <div
      data-testid="demo-banner"
      role="note"
      className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning"
    >
      <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold">{t("billing.demoBanner")}</p>
        {compact ? null : <p className="mt-0.5 text-warning/90">{t("billing.demoBannerHint")}</p>}
      </div>
    </div>
  );
}
