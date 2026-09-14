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

const SLOT_INTERVALS = [5, 10, 15, 20, 30, 60];

const NOTICE_OPTIONS = [
  { value: 0, label: "No minimum — book right up to the minute" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 60 * 12, label: "12 hours" },
  { value: 60 * 24, label: "1 day" },
  { value: 60 * 48, label: "2 days" },
];

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
  const [state, formAction] = useActionState(saveBusinessSettingsAction, idleState);
  const [published, setPublished] = useState(business.is_published);
  const [autoConfirm, setAutoConfirm] = useState(business.auto_confirm);
  const [timezone, setTimezone] = useState(business.timezone);
  const [slotInterval, setSlotInterval] = useState(String(business.slot_interval_min));
  const [minNotice, setMinNotice] = useState(String(business.min_notice_min));
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Saved.");
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);

  const canPublish = activeServiceCount > 0;

  return (
    <form action={formAction} className="space-y-5 pb-24 sm:pb-0">
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      {/* ---- Going live ---------------------------------------------------- */}
      <Card className={published ? "border-success/35" : "border-accent/35"}>
        <CardHeader>
          <CardTitle>Your booking page</CardTitle>
          <CardDescription>
            {published
              ? "Live — customers can find and book you."
              : "Hidden. Switch this on when you are ready to take bookings."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <label htmlFor="isPublished" className="text-sm font-medium">
              Accept bookings
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
            <Alert tone="warning">
              Add at least one active service before going live — there has to be
              something for a customer to book.
            </Alert>
          ) : null}

          {published ? (
            <Link
              href={`/app/b/${business.slug}`}
              target="_blank"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
            >
              View your public page
              <ExternalLink className="size-4" />
            </Link>
          ) : null}
        </CardContent>
      </Card>

      {/* ---- Details ------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Business details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Name" htmlFor="name" error={errors.name} required>
            <Input id="name" name="name" defaultValue={business.name} required />
          </Field>

          <Field label="Description" htmlFor="description" error={errors.description}>
            <Textarea
              id="description"
              name="description"
              defaultValue={business.description ?? ""}
              maxLength={600}
            />
          </Field>

          <Field label="Phone" htmlFor="phone" error={errors.phone} required>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              defaultValue={business.phone ?? ""}
              required
            />
          </Field>

          <Field label="LINE ID" htmlFor="lineId" error={errors.lineId}>
            <Input
              id="lineId"
              name="lineId"
              defaultValue={business.line_id ?? ""}
              autoCapitalize="none"
            />
          </Field>

          <Field label="Address" htmlFor="address" error={errors.address}>
            <Input id="address" name="address" defaultValue={business.address ?? ""} />
          </Field>

          <Field
            label="Time zone"
            error={errors.timezone}
            hint="Every time in Bookly is shown to customers in this zone, wherever they are."
            required
          >
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger aria-label="Time zone">
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

      {/* ---- Booking rules -------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Booking rules</CardTitle>
          <CardDescription>
            These decide which slots a customer is offered.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Offer start times every"
            error={errors.slotInterval}
            hint="Smaller intervals mean more choice but a more fragmented day."
          >
            <Select value={slotInterval} onValueChange={setSlotInterval}>
              <SelectTrigger aria-label="Slot interval">
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
            label="Minimum notice"
            error={errors.minNotice}
            hint="Stops someone booking for five minutes from now while you are mid-cut."
          >
            <Select value={minNotice} onValueChange={setMinNotice}>
              <SelectTrigger aria-label="Minimum notice">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTICE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="minNotice" value={minNotice} />
          </Field>

          <Field
            label="How far ahead customers can book"
            htmlFor="maxAdvanceDays"
            error={errors.maxAdvanceDays}
            hint="Days."
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
                Confirm bookings automatically
              </label>
              <p className="mt-0.5 text-sm text-fg-subtle text-pretty">
                Off means every booking arrives as a request for you to approve.
                The slot is held either way.
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
  return (
    <Button type="submit" size="lg" block variant="accent" loading={pending}>
      Save settings
    </Button>
  );
}
