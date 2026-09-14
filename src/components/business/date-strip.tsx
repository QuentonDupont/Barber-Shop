"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatInBusinessTz, shiftDateKey, type DateKey } from "@/lib/booking/time";
import { cn } from "@/lib/utils";

/**
 * Horizontally scrolling date picker.
 *
 * A month grid is the wrong shape for a phone held in one hand — this is the
 * pattern native calendar apps use, snapping each day into place and keeping
 * the selected day scrolled into view.
 */
export function DateStrip({
  selected,
  today,
  onSelect,
  days = 21,
  countsByDate,
}: {
  selected: DateKey;
  today: DateKey;
  onSelect: (date: DateKey) => void;
  days?: number;
  countsByDate?: Record<DateKey, number>;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Start a few days before the selection so the user can always look back.
  const start = shiftDateKey(selected, -3);
  const dates = Array.from({ length: days }, (_, index) => shiftDateKey(start, index));

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [selected]);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onSelect(shiftDateKey(selected, -1))}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-muted"
        aria-label="Previous day"
      >
        <ChevronLeft className="size-5" />
      </button>

      <div
        ref={scroller}
        className="no-scrollbar snap-x-mandatory flex flex-1 gap-1.5 overflow-x-auto scroll-px-2 px-0.5 py-1"
      >
        {dates.map((date) => {
          const isSelected = date === selected;
          const isToday = date === today;
          const count = countsByDate?.[date] ?? 0;

          return (
            <button
              key={date}
              ref={isSelected ? selectedRef : undefined}
              type="button"
              onClick={() => onSelect(date)}
              aria-current={isSelected ? "date" : undefined}
              className={cn(
                "snap-start-always flex min-h-[4.25rem] w-14 shrink-0 flex-col items-center",
                "justify-center gap-0.5 rounded-xl border transition-colors outline-none",
                "focus-visible:ring-2 focus-visible:ring-accent/40",
                isSelected
                  ? "border-accent bg-accent text-accent-fg"
                  : isToday
                    ? "border-accent/45 bg-accent-soft text-accent"
                    : "border-border bg-surface text-fg-muted hover:bg-surface-muted",
              )}
            >
              <span className="text-[0.625rem] font-semibold uppercase tracking-wide opacity-80">
                {formatInBusinessTz(`${date}T12:00:00Z`, "UTC", "EEE")}
              </span>
              <span className="text-lg font-bold tabular-nums leading-none">
                {formatInBusinessTz(`${date}T12:00:00Z`, "UTC", "d")}
              </span>
              <span
                className={cn(
                  "mt-0.5 h-1.5 w-1.5 rounded-full",
                  count > 0
                    ? isSelected
                      ? "bg-accent-fg"
                      : "bg-accent"
                    : "bg-transparent",
                )}
                aria-hidden
              />
              {count > 0 ? (
                <span className="sr-only">
                  {count} booking{count === 1 ? "" : "s"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onSelect(shiftDateKey(selected, 1))}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-muted"
        aria-label="Next day"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
