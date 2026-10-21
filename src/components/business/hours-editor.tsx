"use client";

import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { DayHours } from "@/lib/booking/hours";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

/**
 * The weekly template editor.
 *
 * Native `<input type="time">` on purpose: iOS and Android both render their
 * own wheel picker for it, which beats anything a web app can build and works
 * with the user's own 12/24-hour preference. One card per day so nothing has
 * to scroll sideways on a 360px screen.
 */
export function HoursEditor({
  value,
  onChange,
  name = "payload",
}: {
  value: DayHours[];
  onChange: (next: DayHours[]) => void;
  name?: string;
}) {
  const t = useT();
  const weekdayLabels: Record<number, string> = {
    0: t("hoursAdmin.weekday0"),
    1: t("hoursAdmin.weekday1"),
    2: t("hoursAdmin.weekday2"),
    3: t("hoursAdmin.weekday3"),
    4: t("hoursAdmin.weekday4"),
    5: t("hoursAdmin.weekday5"),
    6: t("hoursAdmin.weekday6"),
  };
  const update = (weekday: number, patch: Partial<DayHours>) => {
    onChange(value.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)));
  };

  // Render Monday first — a shop week starts on Monday, even though Postgres
  // numbers Sunday as 0.
  const ordered = [1, 2, 3, 4, 5, 6, 0]
    .map((weekday) => value.find((day) => day.weekday === weekday))
    .filter((day): day is DayHours => Boolean(day));

  // Copy from the first day that is actually OPEN. Sourcing from Monday
  // regardless meant a closed Monday's stale times silently overwrote the
  // whole week.
  const source = ordered.find((day) => !day.isClosed) ?? null;
  const targetCount = ordered.filter(
    (day) => !day.isClosed && day.weekday !== source?.weekday,
  ).length;

  /** Most shops keep one schedule all week; typing it seven times is a chore. */
  const copyToAllOpenDays = () => {
    if (!source || targetCount === 0) return;
    const previous = value;
    onChange(
      value.map((day) =>
        day.weekday === source.weekday || day.isClosed
          ? day
          : {
              ...day,
              open: source.open,
              close: source.close,
              breakEnabled: source.breakEnabled,
              breakStart: source.breakStart,
              breakEnd: source.breakEnd,
            },
      ),
    );
    toast.success(
      t("hoursAdmin.copiedToast", {
        weekday: weekdayLabels[source.weekday] ?? "",
        open: source.open,
        close: source.close,
        count: targetCount,
      }),
      {
        duration: 10_000,
        action: { label: t("hoursAdmin.undo"), onClick: () => onChange(previous) },
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="subtle"
          size="sm"
          onClick={copyToAllOpenDays}
          disabled={!source || targetCount === 0}
        >
          <Copy />
          {source
            ? t("hoursAdmin.copyWeekdayToAllOpenDays", { weekday: weekdayLabels[source.weekday] ?? "" })
            : t("hoursAdmin.copyToAllOpenDays")}
        </Button>
      </div>

      {ordered.map((day) => (
        <div
          key={day.weekday}
          className={cn(
            "rounded-xl border bg-surface p-3.5 transition-colors sm:p-4",
            day.isClosed ? "border-border bg-surface-muted/50" : "border-border",
          )}
        >
          <div className="flex min-h-11 items-center justify-between gap-3">
            <label
              htmlFor={`open-${day.weekday}`}
              className="text-[0.9375rem] font-semibold"
            >
              {weekdayLabels[day.weekday]}
            </label>
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "text-sm font-medium",
                  day.isClosed ? "text-fg-subtle" : "text-success",
                )}
              >
                {day.isClosed ? t("hoursAdmin.closed") : t("hoursAdmin.open")}
              </span>
              <Switch
                id={`open-${day.weekday}`}
                checked={!day.isClosed}
                onCheckedChange={(checked) => update(day.weekday, { isClosed: !checked })}
                aria-label={t("hoursAdmin.dayOpenLabel", { weekday: weekdayLabels[day.weekday] ?? "" })}
              />
            </div>
          </div>

          {!day.isClosed ? (
            <div className="mt-3 space-y-3 border-t border-border pt-3">
              <div className="grid grid-cols-2 gap-2.5">
                <TimeField
                  label={t("hoursAdmin.opens")}
                  value={day.open}
                  onChange={(open) => update(day.weekday, { open })}
                />
                <TimeField
                  label={t("hoursAdmin.closes")}
                  value={day.close}
                  onChange={(close) => update(day.weekday, { close })}
                />
              </div>

              <div className="flex min-h-11 items-center justify-between gap-3">
                <label
                  htmlFor={`break-${day.weekday}`}
                  className="text-sm font-medium text-fg-muted"
                >
                  {t("hoursAdmin.lunchOrBreak")}
                </label>
                <Switch
                  id={`break-${day.weekday}`}
                  checked={day.breakEnabled}
                  onCheckedChange={(breakEnabled) => update(day.weekday, { breakEnabled })}
                  aria-label={t("hoursAdmin.dayBreakLabel", { weekday: weekdayLabels[day.weekday] ?? "" })}
                />
              </div>

              {day.breakEnabled ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <TimeField
                    label={t("hoursAdmin.breakStarts")}
                    value={day.breakStart}
                    onChange={(breakStart) => update(day.weekday, { breakStart })}
                  />
                  <TimeField
                    label={t("hoursAdmin.breakEnds")}
                    value={day.breakEnd}
                    onChange={(breakEnd) => update(day.weekday, { breakEnd })}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}

      <input type="hidden" name={name} value={JSON.stringify({ days: value })} />
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-fg-subtle">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        step={300}
        className={cn(
          "h-12 w-full rounded-lg border border-border-strong bg-surface px-3 text-base text-fg",
          "outline-none transition-colors",
          "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25",
        )}
      />
    </label>
  );
}
