"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { WEEKDAY_LABELS } from "@/lib/booking/time";
import { cn } from "@/lib/utils";

export interface DayHours {
  weekday: number;
  isClosed: boolean;
  open: string;
  close: string;
  breakEnabled: boolean;
  breakStart: string;
  breakEnd: string;
}

export const DEFAULT_WEEK: DayHours[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  isClosed: weekday === 0,
  open: "09:00",
  close: "18:00",
  breakEnabled: false,
  breakStart: "12:00",
  breakEnd: "13:00",
}));

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
  const [copied, setCopied] = useState(false);

  const update = (weekday: number, patch: Partial<DayHours>) => {
    onChange(value.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)));
  };

  /** Most shops keep one schedule all week; typing it seven times is a chore. */
  const copyToAllOpenDays = () => {
    const monday = value.find((day) => day.weekday === 1) ?? value[0];
    if (!monday) return;
    onChange(
      value.map((day) =>
        day.weekday === monday.weekday || day.isClosed
          ? day
          : {
              ...day,
              open: monday.open,
              close: monday.close,
              breakEnabled: monday.breakEnabled,
              breakStart: monday.breakStart,
              breakEnd: monday.breakEnd,
            },
      ),
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  // Render Monday first — a shop week starts on Monday, even though Postgres
  // numbers Sunday as 0.
  const ordered = [1, 2, 3, 4, 5, 6, 0]
    .map((weekday) => value.find((day) => day.weekday === weekday))
    .filter((day): day is DayHours => Boolean(day));

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button type="button" variant="subtle" size="sm" onClick={copyToAllOpenDays}>
          <Copy />
          {copied ? "Copied to every open day" : "Copy Monday to all"}
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
              {WEEKDAY_LABELS[day.weekday]}
            </label>
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "text-sm font-medium",
                  day.isClosed ? "text-fg-subtle" : "text-success",
                )}
              >
                {day.isClosed ? "Closed" : "Open"}
              </span>
              <Switch
                id={`open-${day.weekday}`}
                checked={!day.isClosed}
                onCheckedChange={(checked) => update(day.weekday, { isClosed: !checked })}
                aria-label={`${WEEKDAY_LABELS[day.weekday]} open`}
              />
            </div>
          </div>

          {!day.isClosed ? (
            <div className="mt-3 space-y-3 border-t border-border pt-3">
              <div className="grid grid-cols-2 gap-2.5">
                <TimeField
                  label="Opens"
                  value={day.open}
                  onChange={(open) => update(day.weekday, { open })}
                />
                <TimeField
                  label="Closes"
                  value={day.close}
                  onChange={(close) => update(day.weekday, { close })}
                />
              </div>

              <div className="flex min-h-11 items-center justify-between gap-3">
                <label
                  htmlFor={`break-${day.weekday}`}
                  className="text-sm font-medium text-fg-muted"
                >
                  Lunch or break
                </label>
                <Switch
                  id={`break-${day.weekday}`}
                  checked={day.breakEnabled}
                  onCheckedChange={(breakEnabled) => update(day.weekday, { breakEnabled })}
                  aria-label={`${WEEKDAY_LABELS[day.weekday]} break`}
                />
              </div>

              {day.breakEnabled ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <TimeField
                    label="Break starts"
                    value={day.breakStart}
                    onChange={(breakStart) => update(day.weekday, { breakStart })}
                  />
                  <TimeField
                    label="Break ends"
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
