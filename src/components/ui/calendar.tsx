"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WEEKDAY_SHORT, shiftDateKey, type DateKey } from "@/lib/booking/time";
import { cn } from "@/lib/utils";

interface CalendarProps {
  selected: DateKey;
  onSelect: (date: DateKey) => void;
  /** `true` means the day has at least one bookable slot. */
  enabledDays: Record<DateKey, boolean>;
  minDate: DateKey;
  maxDate: DateKey;
  today: DateKey;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parts(date: DateKey) {
  const [year, month, day] = date.split("-").map(Number);
  return { year: year ?? 1970, month: (month ?? 1) - 1, day: day ?? 1 };
}

function key(year: number, month: number, day: number): DateKey {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Month grid sized for a thumb.
 *
 * Cells are `aspect-square` inside a 7-column grid, which lands at roughly 44px
 * on a 360px screen and grows from there — no fixed pixel sizes that would
 * either overflow a small phone or look lost on a tablet.
 */
export function Calendar({
  selected,
  onSelect,
  enabledDays,
  minDate,
  maxDate,
  today,
}: CalendarProps) {
  const initial = parts(selected);
  const [cursor, setCursor] = useState({ year: initial.year, month: initial.month });

  const grid = useMemo(() => {
    const first = new Date(Date.UTC(cursor.year, cursor.month, 1));
    const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
    const leading = first.getUTCDay();

    const cells: (DateKey | null)[] = Array.from({ length: leading }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(key(cursor.year, cursor.month, day));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const monthStart = key(cursor.year, cursor.month, 1);
  const monthEnd = key(
    cursor.year,
    cursor.month,
    new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate(),
  );
  const canGoBack = monthStart > minDate;
  const canGoForward = monthEnd < maxDate;

  const step = (direction: -1 | 1) => {
    setCursor((current) => {
      const month = current.month + direction;
      if (month < 0) return { year: current.year - 1, month: 11 };
      if (month > 11) return { year: current.year + 1, month: 0 };
      return { ...current, month };
    });
  };

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={!canGoBack}
          className="flex size-11 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-muted disabled:opacity-30"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-5" />
        </button>

        <p className="text-base font-semibold" aria-live="polite">
          {MONTH_NAMES[cursor.month]} {cursor.year}
        </p>

        <button
          type="button"
          onClick={() => step(1)}
          disabled={!canGoForward}
          className="flex size-11 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-muted disabled:opacity-30"
          aria-label="Next month"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid">
        {WEEKDAY_SHORT.map((label) => (
          <div
            key={label}
            role="columnheader"
            className="pb-1 text-center text-[0.6875rem] font-semibold uppercase tracking-wide text-fg-subtle"
          >
            {label.charAt(0)}
          </div>
        ))}

        {grid.map((date, index) => {
          if (!date) return <div key={`pad-${index}`} aria-hidden />;

          const outOfRange = date < minDate || date > maxDate;
          const available = !outOfRange && enabledDays[date] === true;
          const isSelected = date === selected;
          const isToday = date === today;

          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              disabled={!available}
              aria-selected={isSelected}
              aria-label={date}
              onClick={() => onSelect(date)}
              className={cn(
                "flex aspect-square min-h-11 items-center justify-center rounded-lg",
                "text-sm font-semibold tabular-nums transition-colors outline-none",
                "focus-visible:ring-2 focus-visible:ring-accent/40",
                isSelected
                  ? "bg-accent text-accent-fg"
                  : available
                    ? "bg-surface-muted text-fg hover:bg-accent-soft hover:text-accent"
                    : "text-fg-subtle/45 line-through decoration-1",
                !isSelected && isToday && available && "ring-1 ring-accent/50",
              )}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>

      <p className="mt-3 flex items-center gap-3 text-xs text-fg-subtle">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-surface-muted" aria-hidden />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-border" aria-hidden />
          Closed or full
        </span>
      </p>
    </div>
  );
}

export { shiftDateKey };
