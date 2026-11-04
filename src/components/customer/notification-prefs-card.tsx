"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveMarketingPrefAction, saveServicePrefsAction } from "@/lib/actions/account";
import { DEFAULT_PREFS, type NotificationPrefs } from "@/lib/account/prefs";
import { DEFAULT_TIMEZONE, formatInBusinessTz } from "@/lib/booking/time";
import { useLocale, useT } from "@/lib/i18n/context";

function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-1.5">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-sm font-medium text-fg">{label}</span>
        <span className="block text-sm text-fg-muted">{hint}</span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * Two separate cards on purpose: booking messages (service, default on) and
 * marketing (opt-in, default off, its own save and consent note).
 */
export function NotificationPrefsCards({ prefs }: { prefs: NotificationPrefs | null }) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const start = prefs ?? DEFAULT_PREFS;

  const [confirmations, setConfirmations] = useState(start.booking_confirmations);
  const [reminders, setReminders] = useState(start.reminders);
  const [marketing, setMarketing] = useState(start.marketing);
  const [serviceBusy, startService] = useTransition();
  const [marketingBusy, startMarketing] = useTransition();

  const fmt = (iso: string) => formatInBusinessTz(iso, DEFAULT_TIMEZONE, "d MMM yyyy", locale);

  return (
    <>
      <Card data-testid="service-prefs-card">
        <CardHeader>
          <CardTitle>{t("accountCustomer.notifTitle")}</CardTitle>
          <CardDescription>{t("accountCustomer.notifDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SwitchRow
            id="pref-confirmations"
            label={t("accountCustomer.notifConfirmations")}
            hint={t("accountCustomer.notifConfirmationsHint")}
            checked={confirmations}
            onChange={setConfirmations}
          />
          <SwitchRow
            id="pref-reminders"
            label={t("accountCustomer.notifReminders")}
            hint={t("accountCustomer.notifRemindersHint")}
            checked={reminders}
            onChange={setReminders}
          />
          <Button
            type="button"
            size="md"
            block
            variant="outline"
            loading={serviceBusy}
            onClick={() =>
              startService(async () => {
                const r = await saveServicePrefsAction({ bookingConfirmations: confirmations, reminders });
                if (r.status === "success") toast.success(r.message);
                else toast.error(r.message);
                router.refresh();
              })
            }
          >
            {t("accountCustomer.notifSave")}
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="marketing-card">
        <CardHeader>
          <CardTitle>{t("accountCustomer.marketingTitle")}</CardTitle>
          <CardDescription>{t("accountCustomer.marketingHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SwitchRow
            id="pref-marketing"
            label={t("accountCustomer.marketingLabel")}
            hint={t("accountCustomer.marketingConsentNote")}
            checked={marketing}
            onChange={setMarketing}
          />
          {start.marketing && start.marketing_consented_at ? (
            <p className="text-sm text-fg-muted" data-testid="marketing-since">
              {t("accountCustomer.marketingOnSince", { date: fmt(start.marketing_consented_at) })}
            </p>
          ) : start.marketing_withdrawn_at ? (
            <p className="text-sm text-fg-muted" data-testid="marketing-since">
              {t("accountCustomer.marketingOffSince", { date: fmt(start.marketing_withdrawn_at) })}
            </p>
          ) : null}
          <Button
            type="button"
            size="md"
            block
            variant="outline"
            loading={marketingBusy}
            onClick={() =>
              startMarketing(async () => {
                const r = await saveMarketingPrefAction({ marketing });
                if (r.status === "success") toast.success(r.message);
                else toast.error(r.message);
                router.refresh();
              })
            }
          >
            {t("accountCustomer.marketingSave")}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
