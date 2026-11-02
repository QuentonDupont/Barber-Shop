"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { CalendarOff, CalendarPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/misc";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { deleteOverrideAction, saveOverrideAction } from "@/lib/actions/overrides";
import { idleState } from "@/lib/actions/types";
import type { AvailabilityOverrideRow } from "@/lib/database.types";
import {
  formatInBusinessTz,
  minutesToDisplay,
  parseTimeToMinutes,
} from "@/lib/booking/time";
import { useT, useLocale } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

/**
 * One-off days: holidays, half days, a late opening.
 *
 * Kept next to the weekly template on the Hours page rather than buried in
 * settings, because "we're shut next Monday" is something an owner does on
 * their phone the moment they decide it.
 */
export function OverridesManager({
  overrides,
  today,
}: {
  overrides: AvailabilityOverrideRow[];
  today: string;
}) {
  const t = useT();
  const [adding, setAdding] = useState(false);

  return (
    <section className="mt-10 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">{t("hoursAdmin.oneOffDaysHeading")}</h2>
          <p className="mt-0.5 text-sm text-fg-muted text-pretty">
            {t("hoursAdmin.oneOffDaysDescription")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="shrink-0">
          <CalendarPlus />
          {t("hoursAdmin.addADay")}
        </Button>
      </div>

      {overrides.length === 0 ? (
        <EmptyState
          icon={CalendarOff}
          title={t("hoursAdmin.noOneOffDaysTitle")}
          description={t("hoursAdmin.noOneOffDaysDescription")}
        />
      ) : (
        <ul className="space-y-2">
          {overrides.map((row) => (
            <OverrideRow key={row.id} row={row} />
          ))}
        </ul>
      )}

      <AddOverrideSheet
        key={adding ? "open" : "closed"}
        open={adding}
        onOpenChange={setAdding}
        today={today}
      />
    </section>
  );
}

function OverrideRow({ row }: { row: AvailabilityOverrideRow }) {
  const t = useT();
  const { locale } = useLocale();
  const [state, formAction] = useActionState(deleteOverrideAction, idleState);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? t("common.removed"));
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state, t]);

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {formatInBusinessTz(`${row.date}T12:00:00Z`, "UTC", "EEEE d MMMM yyyy", locale)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {row.is_closed ? (
            <Badge tone="danger">
              <CalendarOff />
              {t("hoursAdmin.closed")}
            </Badge>
          ) : (
            <Badge tone="accent">
              {minutesToDisplay(parseTimeToMinutes(row.open_time ?? "00:00"))} –{" "}
              {minutesToDisplay(parseTimeToMinutes(row.close_time ?? "00:00"))}
            </Badge>
          )}
          {row.note ? <span className="text-sm text-fg-subtle">{row.note}</span> : null}
        </div>
      </div>
      <form action={formAction}>
        <input type="hidden" name="id" value={row.id} />
        <DeleteButton label={row.date} />
      </form>
    </li>
  );
}

function DeleteButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={t("hoursAdmin.removeOneOffDay", { date: label })}
      className="flex size-11 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

function AddOverrideSheet({
  open,
  onOpenChange,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: string;
}) {
  const t = useT();
  const [state, formAction] = useActionState(saveOverrideAction, idleState);
  const [mode, setMode] = useState<"closed" | "custom">("closed");
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? t("common.saved"));
      onOpenChange(false);
    }
  }, [state, onOpenChange, t]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("hoursAdmin.addOneOffDayTitle")}</SheetTitle>
          <SheetDescription>{t("hoursAdmin.addOneOffDayDescription")}</SheetDescription>
        </SheetHeader>

        <form action={formAction} noValidate>
          <SheetBody>
            {state.status === "error" && state.message ? (
              <Alert tone="error">{state.message}</Alert>
            ) : null}

            <Field label={t("hoursAdmin.dateLabel")} htmlFor="override-date" error={errors.date} required>
              <Input
                id="override-date"
                name="date"
                type="date"
                min={today}
                defaultValue={today}
                required
                aria-invalid={Boolean(errors.date)}
              />
            </Field>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">{t("hoursAdmin.whatHappensLegend")}</legend>
              <div role="radiogroup" className="grid grid-cols-2 gap-2 rounded-xl bg-surface-muted p-1.5">
                {(
                  [
                    ["closed", t("hoursAdmin.closedAllDay")],
                    ["custom", t("hoursAdmin.differentHours")],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={mode === value}
                    onClick={() => setMode(value)}
                    className={cn(
                      "min-h-12 rounded-lg px-3 text-sm font-semibold transition-colors outline-none",
                      "focus-visible:ring-2 focus-visible:ring-accent/40",
                      mode === value
                        ? "bg-surface text-fg shadow-sm ring-1 ring-accent/30"
                        : "text-fg-muted hover:text-fg",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input type="hidden" name="mode" value={mode} />
            </fieldset>

            {mode === "custom" ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("hoursAdmin.opens")} htmlFor="override-open" error={errors.openTime} required>
                  <Input id="override-open" name="openTime" type="time" step={300} defaultValue="10:00" />
                </Field>
                <Field label={t("hoursAdmin.closes")} htmlFor="override-close" error={errors.closeTime} required>
                  <Input id="override-close" name="closeTime" type="time" step={300} defaultValue="16:00" />
                </Field>
              </div>
            ) : null}

            <Field
              label={t("hoursAdmin.noteLabel")}
              htmlFor="override-note"
              error={errors.note}
              hint={t("hoursAdmin.noteHint")}
            >
              <Input
                id="override-note"
                name="note"
                maxLength={120}
                placeholder={t("hoursAdmin.notePlaceholder")}
                enterKeyHint="done"
              />
            </Field>
          </SheetBody>

          <SheetFooter>
            <Button type="button" variant="ghost" size="md" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <SaveButton />
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" size="lg" variant="accent" loading={pending} className="sm:w-auto">
      {t("hoursAdmin.saveDay")}
    </Button>
  );
}
