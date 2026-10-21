"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveBusinessSettingsAction } from "@/lib/actions/business";
import { idleState } from "@/lib/actions/types";
import type { BusinessRow } from "@/lib/database.types";
import { formatDuration } from "@/lib/booking/time";
import { businessPath } from "@/lib/routes";
import { useT } from "@/lib/i18n/context";

const SLOT_INTERVALS = [5, 10, 15, 20, 30, 60];

const NOTICE_VALUES = [0, 30, 60, 120, 60 * 12, 60 * 24, 60 * 48] as const;

const NOTICE_KEYS: Record<number, string> = {
  0: "settingsAdmin.notice0",
  30: "settingsAdmin.notice30",
  60: "settingsAdmin.notice60",
  120: "settingsAdmin.notice120",
  [60 * 12]: "settingsAdmin.notice720",
  [60 * 24]: "settingsAdmin.notice1440",
  [60 * 48]: "settingsAdmin.notice2880",
};

const TIMEZONES = [
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Jakarta",
  "Asia/Ho_Chi_Minh",
  "Asia/Manila",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

export function SettingsForm({
  business,
  activeServiceCount,
}: {
  business: BusinessRow;
  activeServiceCount: number;
}) {
  const t = useT();
  const [state, formAction] = useActionState(saveBusinessSettingsAction, idleState);
  const [published, setPublished] = useState(business.is_published);
  const [autoConfirm, setAutoConfirm] = useState(business.auto_confirm);
  const [timezone, setTimezone] = useState(business.timezone);
  const [slotInterval, setSlotInterval] = useState(String(business.slot_interval_min));
  const [minNotice, setMinNotice] = useState(String(business.min_notice_min));
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? t("common.saved"));
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state, t]);

  const canPublish = activeServiceCount > 0;

  return (
    <form action={formAction} className="space-y-5 pb-24 sm:pb-0">
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      {/* ---- Going live ---------------------------------------------------- */}
      <Card className={published ? "border-success/35" : "border-accent/35"}>
        <CardHeader>
          <CardTitle>{t("settingsAdmin.bookingPageTitle")}</CardTitle>
          <CardDescription>
            {published
              ? t("settingsAdmin.bookingPageLive")
              : t("settingsAdmin.bookingPageHidden")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <label htmlFor="isPublished" className="text-sm font-medium">
              {t("settingsAdmin.acceptBookings")}
            </label>
            <Switch
              id="isPublished"
              checked={published}
              onCheckedChange={setPublished}
              disabled={!canPublish}
            />
            <input type="hidden" name="isPublished" value={published ? "on" : "off"} />
          </div>

          {!canPublish ? (
            <Alert tone="warning">{t("settingsAdmin.needServiceWarning")}</Alert>
          ) : null}

          {published ? (
            <Link
              href={businessPath(business.slug)}
              target="_blank"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
            >
              {t("settingsAdmin.viewPublicPage")}
              <ExternalLink className="size-4" />
            </Link>
          ) : null}
        </CardContent>
      </Card>

      {/* ---- Details ------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settingsAdmin.businessDetailsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label={t("settingsAdmin.nameLabel")} htmlFor="name" error={errors.name} required>
            <Input id="name" name="name" defaultValue={business.name} required />
          </Field>

          <Field label={t("settingsAdmin.descriptionLabel")} htmlFor="description" error={errors.description}>
            <Textarea
              id="description"
              name="description"
              defaultValue={business.description ?? ""}
              maxLength={600}
            />
          </Field>

          <Field label={t("settingsAdmin.phoneLabel")} htmlFor="phone" error={errors.phone} required>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              defaultValue={business.phone ?? ""}
              required
            />
          </Field>

          <Field label={t("settingsAdmin.lineIdLabel")} htmlFor="lineId" error={errors.lineId}>
            <Input
              id="lineId"
              name="lineId"
              defaultValue={business.line_id ?? ""}
              autoCapitalize="none"
            />
          </Field>

          <Field label={t("settingsAdmin.addressLabel")} htmlFor="address" error={errors.address}>
            <Input id="address" name="address" defaultValue={business.address ?? ""} />
          </Field>

          <Field
            label={t("settingsAdmin.timezoneLabel")}
            error={errors.timezone}
            hint={t("settingsAdmin.timezoneHint")}
            required
          >
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger aria-label={t("settingsAdmin.timezoneLabel")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="timezone" value={timezone} />
          </Field>
        </CardContent>
      </Card>

      {/* ---- Cancellation / no-show policy ----------------------------------
          roadmap.md §1 row 6: one string, shown on the listing page, the
          booking-confirmation screen and the confirmation email — nothing
          more to configure here, by design (no fee calculator yet). */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settingsAdmin.cancellationPolicyTitle")}</CardTitle>
          <CardDescription>{t("settingsAdmin.cancellationPolicyDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Field
            label={t("settingsAdmin.policyLabel")}
            htmlFor="cancellationPolicy"
            error={errors.cancellationPolicy}
            hint={t("settingsAdmin.policyHint")}
          >
            <Textarea
              id="cancellationPolicy"
              name="cancellationPolicy"
              defaultValue={business.cancellation_policy ?? ""}
              maxLength={500}
            />
          </Field>
        </CardContent>
      </Card>

      {/* ---- Booking rules -------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settingsAdmin.bookingRulesTitle")}</CardTitle>
          <CardDescription>{t("settingsAdmin.bookingRulesDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label={t("settingsAdmin.slotIntervalLabel")}
            error={errors.slotInterval}
            hint={t("settingsAdmin.slotIntervalHint")}
          >
            <Select value={slotInterval} onValueChange={setSlotInterval}>
              <SelectTrigger aria-label={t("settingsAdmin.slotIntervalLabel")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SLOT_INTERVALS.map((minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {formatDuration(minutes)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="slotInterval" value={slotInterval} />
          </Field>

          <Field
            label={t("settingsAdmin.minNoticeLabel")}
            error={errors.minNotice}
            hint={t("settingsAdmin.minNoticeHint")}
          >
            <Select value={minNotice} onValueChange={setMinNotice}>
              <SelectTrigger aria-label={t("settingsAdmin.minNoticeLabel")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTICE_VALUES.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {t(NOTICE_KEYS[value] ?? "")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="minNotice" value={minNotice} />
          </Field>

          <Field
            label={t("settingsAdmin.maxAdvanceLabel")}
            htmlFor="maxAdvanceDays"
            error={errors.maxAdvanceDays}
            hint={t("settingsAdmin.maxAdvanceHint")}
          >
            <Input
              id="maxAdvanceDays"
              name="maxAdvanceDays"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              defaultValue={business.max_advance_days}
            />
          </Field>

          <div className="flex min-h-11 items-start justify-between gap-3 rounded-lg bg-surface-muted p-3.5">
            <div className="min-w-0">
              <label htmlFor="autoConfirm" className="text-sm font-medium">
                {t("settingsAdmin.autoConfirmLabel")}
              </label>
              <p className="mt-0.5 text-sm text-fg-subtle text-pretty">
                {t("settingsAdmin.autoConfirmDescription")}
              </p>
            </div>
            <Switch
              id="autoConfirm"
              checked={autoConfirm}
              onCheckedChange={setAutoConfirm}
              className="mt-0.5 shrink-0"
            />
            <input type="hidden" name="autoConfirm" value={autoConfirm ? "on" : "off"} />
          </div>
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 p-4 pb-nav backdrop-blur-md sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0 sm:backdrop-blur-none">
        <SaveButton />
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" size="lg" block variant="accent" loading={pending}>
      {t("settingsAdmin.saveSettings")}
    </Button>
  );
}
