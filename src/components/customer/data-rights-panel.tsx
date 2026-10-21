"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale, useT } from "@/lib/i18n/context";
import { DEFAULT_TIMEZONE, formatInBusinessTz } from "@/lib/booking/time";
import { PRIVACY_POLICY_ROUTE } from "@/lib/privacy/policy";
import {
  exportMyDataAction,
  recordConsentAction,
  requestDeletionAction,
  withdrawConsentAction,
} from "@/lib/actions/privacy";

export interface ConsentSummary {
  policyVersion: string;
  consentedAt: string;
  withdrawnAt: string | null;
}

export interface DeletionSummary {
  requestedAt: string;
}

/**
 * The account page's "Your data" section (handoff 07, items 11-15): shows
 * the current consent record and offers the three data-subject-rights
 * actions. All four server actions are scoped to the signed-in user
 * (`src/lib/actions/privacy.ts`) — this component only displays what comes
 * back and refreshes the page's server data after a mutation.
 */
export function DataRightsPanel({
  consent,
  deletionPending,
}: {
  consent: ConsentSummary | null;
  deletionPending: DeletionSummary | null;
}) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const fmt = (iso: string) => formatInBusinessTz(iso, DEFAULT_TIMEZONE, "d MMM yyyy", locale);
  const isWithdrawn = Boolean(consent?.withdrawnAt);

  function handleDownload() {
    startTransition(async () => {
      const result = await exportMyDataAction();
      if (result.status !== "success" || !result.json) {
        toast.error(result.message ?? t("privacy.downloadDataError"));
        return;
      }
      const blob = new Blob([result.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "tatnat-my-data.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(result.message ?? t("privacy.downloadDataSuccess"));
    });
  }

  function handleRequestDeletion() {
    if (!window.confirm(t("privacy.requestDeletionConfirm"))) return;
    startTransition(async () => {
      const result = await requestDeletionAction();
      if (result.status === "error") toast.error(result.message ?? "");
      else toast.success(result.message ?? "");
      router.refresh();
    });
  }

  function handleWithdraw() {
    if (!window.confirm(t("privacy.withdrawConsentConfirm"))) return;
    startTransition(async () => {
      const result = await withdrawConsentAction();
      if (result.status === "error") toast.error(result.message ?? "");
      else toast.success(result.message ?? "");
      router.refresh();
    });
  }

  function handleReconsent() {
    startTransition(async () => {
      const { error } = await recordConsentAction();
      if (error) toast.error(error);
      else toast.success(t("privacy.reconsentSuccess"));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("privacy.yourDataTitle")}</CardTitle>
        <CardDescription>{t("privacy.yourDataDescription")}</CardDescription>
        <Link
          href={PRIVACY_POLICY_ROUTE}
          target="_blank"
          className="inline-block text-sm font-semibold text-accent hover:underline"
        >
          {t("privacy.viewPolicyLink")}
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {consent ? (
            <>
              <Badge tone={isWithdrawn ? "warning" : "success"}>
                {isWithdrawn
                  ? t("privacy.consentWithdrawnLabel", { date: fmt(consent.withdrawnAt as string) })
                  : t("privacy.consentStatusLabel")}
              </Badge>
              <span className="text-fg-muted">
                {t("privacy.consentVersionLabel", {
                  version: consent.policyVersion,
                  date: fmt(consent.consentedAt),
                })}
              </span>
            </>
          ) : (
            <span className="text-fg-muted">{t("privacy.consentNoneLabel")}</span>
          )}
        </div>

        {deletionPending ? (
          <Badge tone="warning">
            {t("privacy.requestDeletionPending", { date: fmt(deletionPending.requestedAt) })}
          </Badge>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleDownload}
            loading={pending}
          >
            <Download />
            {t("privacy.downloadDataButton")}
          </Button>

          {isWithdrawn ? (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleReconsent}
              loading={pending}
            >
              <ShieldCheck />
              {t("privacy.reconsentButton")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleWithdraw}
              loading={pending}
            >
              <ShieldOff />
              {t("privacy.withdrawConsentButton")}
            </Button>
          )}

          {!deletionPending ? (
            <Button
              type="button"
              variant="outline"
              size="md"
              className="text-danger"
              onClick={handleRequestDeletion}
              loading={pending}
            >
              <Trash2 />
              {t("privacy.requestDeletionButton")}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
