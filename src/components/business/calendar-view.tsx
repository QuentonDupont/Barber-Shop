"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarX2 } from "lucide-react";
import { DateStrip } from "./date-strip";
import { OwnerBookingRow } from "./booking-row";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/misc";
import { BookingStatusBadge } from "@/components/shared/booking-status";
import type { BookingRow, BusinessRow } from "@/lib/database.types";
import {
  formatInBusinessTz,
  localMinutesFromMidnight,
  minutesToDisplay,
  shiftDateKey,
  toDateKey,
  type DateKey,
} from "@/lib/booking/time";
import { cn } from "@/lib/utils";

type Booking = BookingRow;

interface Positioned {
  booking: Booking;
  startMinute: number;
  endMinute: number;
  /** Horizontal lane, so simultaneous bookings sit side by side. */
  lane: number;
  lanes: number;
}

const HOUR_HEIGHT = 56;

export function CalendarView({
  business,
  bookings,
  selectedDate,
  today,
  view,
  weekStart,
}: {
  business: BusinessRow;
  bookings: Booking[];
  selectedDate: DateKey;
  today: DateKey;
  view: "day" | "week";
  weekStart: DateKey;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const navigate = (next: { date?: DateKey; view?: "day" | "week" }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.date) params.set("date", next.date);
    if (next.view) params.set("view", next.view);
    router.replace(`/dashboard/calendar?${params.toString()}`, { scroll: false });
  };

  const byDate = useMemo(() => {
    const map: Record<DateKey, Booking[]> = {};
    for (const booking of bookings) {
      const key = toDateKey(new Date(booking.starts_at), business.timezone);
      (map[key] ??= []).push(booking);
    }
    for (const list of Object.values(map)) {
      list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    }
    return map;
  }, [bookings, business.timezone]);

  const counts = useMemo(() => {
    const out: Record<DateKey, number> = {};
    for (const [date, list] of Object.entries(byDate)) {
      out[date] = list.filter(
        (b) => b.status === "pending" || b.status === "confirmed",
      ).length;
    }
    return out;
  }, [byDate]);

  const weekDates = Array.from({ length: 7 }, (_, i) => shiftDateKey(weekStart, i));

  return (
    <div className="space-y-4">
      <Tabs
        value={view}
        onValueChange={(value) => navigate({ view: value as "day" | "week" })}
      >
        <TabsList className="w-full max-w-64">
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "day" ? (
        <>
          <DateStrip
            selected={selectedDate}
            today={today}
            onSelect={(date) => navigate({ date })}
            countsByDate={counts}
          />
          <DayView
            business={business}
            date={selectedDate}
            bookings={byDate[selectedDate] ?? []}
          />
        </>
      ) : (
        <WeekView
          business={business}
          dates={weekDates}
          today={today}
          byDate={byDate}
          onSelectDay={(date) => navigate({ date, view: "day" })}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function DayView({
  business,
  date,
  bookings,
}: {
  business: BusinessRow;
  date: DateKey;
  bookings: Booking[];
}) {
  const live = bookings.filter((b) => b.status !== "cancelled");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold tracking-tight">
          {formatInBusinessTz(`${date}T12:00:00Z`, "UTC", "EEEE d MMMM yyyy")}
        </h2>
        <p className="text-sm text-fg-muted">
          {live.length === 0
            ? "Nothing booked"
            : `${live.length} booking${live.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="No bookings on this day"
          description="Slots stay open until someone takes them."
        />
      ) : (
        <>
          {/* Timeline on tablet and up; a plain list is easier to act on with a
              thumb, so phones get that instead. */}
          <div className="hidden sm:block">
            <TimeGrid business={business} date={date} bookings={bookings} />
          </div>
          <div className="space-y-2.5 sm:hidden">
            {bookings.map((booking) => (
              <OwnerBookingRow
                key={booking.id}
                booking={booking}
                timezone={business.timezone}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function WeekView({
  business,
  dates,
  today,
  byDate,
  onSelectDay,
}: {
  business: BusinessRow;
  dates: DateKey[];
  today: DateKey;
  byDate: Record<DateKey, Booking[]>;
  onSelectDay: (date: DateKey) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold tracking-tight">
        {formatInBusinessTz(`${dates[0]}T12:00:00Z`, "UTC", "d MMM")} –{" "}
        {formatInBusinessTz(`${dates[6]}T12:00:00Z`, "UTC", "d MMM yyyy")}
      </h2>

      {/* A seven-column time grid is unreadable at 360px, so the week becomes a
          grouped agenda on phones and a grid from `lg` up. */}
      <div className="space-y-5 lg:hidden">
        {dates.map((date) => {
          const list = byDate[date] ?? [];
          return (
            <section key={date} className="space-y-2.5">
              <button
                type="button"
                onClick={() => onSelectDay(date)}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between rounded-lg px-1 text-left",
                  date === today ? "text-accent" : "text-fg",
                )}
              >
                <span className="text-sm font-bold uppercase tracking-wide">
                  {formatInBusinessTz(`${date}T12:00:00Z`, "UTC", "EEEE d MMM")}
                  {date === today ? " · Today" : ""}
                </span>
                <span className="text-xs font-semibold text-fg-subtle">
                  {list.length === 0 ? "Free" : `${list.length}`}
                </span>
              </button>

              {list.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-fg-subtle">
                  Nothing booked
                </p>
              ) : (
                list.map((booking) => (
                  <OwnerBookingRow
                    key={booking.id}
                    booking={booking}
                    timezone={business.timezone}
                  />
                ))
              )}
            </section>
          );
        })}
      </div>

      <div className="hidden lg:block">
        <WeekGrid business={business} dates={dates} today={today} byDate={byDate} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Shared vertical scale for the timeline views. */
function useGridRange(
  business: BusinessRow,
  dates: DateKey[],
  byDate: Record<DateKey, Booking[]>,
) {
  return useMemo(() => {
    let min = 8 * 60;
    let max = 20 * 60;

    for (const date of dates) {
      for (const booking of byDate[date] ?? []) {
        const start = localMinutesFromMidnight(
          new Date(booking.starts_at),
          business.timezone,
          date,
        );
        const end = localMinutesFromMidnight(
          new Date(booking.ends_at),
          business.timezone,
          date,
        );
        min = Math.min(min, Math.floor(start / 60) * 60);
        max = Math.max(max, Math.ceil(end / 60) * 60);
      }
    }

    return { startMinute: Math.max(0, min), endMinute: Math.min(24 * 60, max) };
  }, [business.timezone, dates, byDate]);
}

/**
 * Packs overlapping bookings into lanes so nothing is hidden behind anything
 * else — a double-booked slot is exactly the case an owner needs to see.
 */
function layout(bookings: Booking[], timezone: string, date: DateKey): Positioned[] {
  const items = bookings.map((booking) => ({
    booking,
    startMinute: localMinutesFromMidnight(new Date(booking.starts_at), timezone, date),
    endMinute: localMinutesFromMidnight(new Date(booking.ends_at), timezone, date),
  }));

  items.sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);

  const positioned: Positioned[] = [];
  let cluster: typeof items = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    const assigned = cluster.map((item) => {
      let lane = laneEnds.findIndex((end) => end <= item.startMinute);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(item.endMinute);
      } else {
        laneEnds[lane] = item.endMinute;
      }
      return { ...item, lane };
    });

    for (const item of assigned) {
      positioned.push({ ...item, lanes: laneEnds.length });
    }
    cluster = [];
  };

  for (const item of items) {
    if (item.startMinute >= clusterEnd) {
      flush();
      clusterEnd = item.endMinute;
    } else {
      clusterEnd = Math.max(clusterEnd, item.endMinute);
    }
    cluster.push(item);
  }
  flush();

  return positioned;
}

function TimeGrid({
  business,
  date,
  bookings,
}: {
  business: BusinessRow;
  date: DateKey;
  bookings: Booking[];
}) {
  const byDate = useMemo(() => ({ [date]: bookings }), [date, bookings]);
  const { startMinute, endMinute } = useGridRange(business, [date], byDate);
  const hours = Math.ceil((endMinute - startMinute) / 60);
  const positioned = useMemo(
    () => layout(bookings, business.timezone, date),
    [bookings, business.timezone, date],
  );

  return (
    <div className="flex gap-2 overflow-hidden rounded-xl border border-border bg-surface p-3">
      <HourGutter startMinute={startMinute} hours={hours} />
      <div className="relative flex-1" style={{ height: hours * HOUR_HEIGHT }}>
        <HourLines hours={hours} />
        {positioned.map((item) => (
          <BookingBlock
            key={item.booking.id}
            item={item}
            gridStart={startMinute}
            timezone={business.timezone}
          />
        ))}
      </div>
    </div>
  );
}

function WeekGrid({
  business,
  dates,
  today,
  byDate,
}: {
  business: BusinessRow;
  dates: DateKey[];
  today: DateKey;
  byDate: Record<DateKey, Booking[]>;
}) {
  const { startMinute, endMinute } = useGridRange(business, dates, byDate);
  const hours = Math.ceil((endMinute - startMinute) / 60);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-border">
        <span />
        {dates.map((date) => (
          <span
            key={date}
            className={cn(
              "border-l border-border px-2 py-2 text-center text-xs font-semibold",
              date === today ? "bg-accent-soft text-accent" : "text-fg-muted",
            )}
          >
            <span className="block uppercase tracking-wide">
              {formatInBusinessTz(`${date}T12:00:00Z`, "UTC", "EEE")}
            </span>
            <span className="block text-base font-bold tabular-nums text-fg">
              {formatInBusinessTz(`${date}T12:00:00Z`, "UTC", "d")}
            </span>
          </span>
        ))}
      </div>

      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] p-2 pl-0">
        <HourGutter startMinute={startMinute} hours={hours} />
        {dates.map((date) => {
          const positioned = layout(byDate[date] ?? [], business.timezone, date);
          return (
            <div
              key={date}
              className="relative border-l border-border"
              style={{ height: hours * HOUR_HEIGHT }}
            >
              <HourLines hours={hours} />
              {positioned.map((item) => (
                <BookingBlock
                  key={item.booking.id}
                  item={item}
                  gridStart={startMinute}
                  timezone={business.timezone}
                  compact
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HourGutter({ startMinute, hours }: { startMinute: number; hours: number }) {
  return (
    <div className="w-14 shrink-0" style={{ height: hours * HOUR_HEIGHT }}>
      {Array.from({ length: hours }, (_, index) => (
        <div
          key={index}
          className="relative text-right text-[0.6875rem] font-medium text-fg-subtle"
          style={{ height: HOUR_HEIGHT }}
        >
          <span className="absolute right-2 -top-1.5">
            {minutesToDisplay(startMinute + index * 60)}
          </span>
        </div>
      ))}
    </div>
  );
}

function HourLines({ hours }: { hours: number }) {
  return (
    <>
      {Array.from({ length: hours }, (_, index) => (
        <div
          key={index}
          className="absolute inset-x-0 border-t border-border/70"
          style={{ top: index * HOUR_HEIGHT }}
          aria-hidden
        />
      ))}
    </>
  );
}

function BookingBlock({
  item,
  gridStart,
  timezone,
  compact,
}: {
  item: Positioned;
  gridStart: number;
  timezone: string;
  compact?: boolean;
}) {
  const top = ((item.startMinute - gridStart) / 60) * HOUR_HEIGHT;
  const height = Math.max(
    22,
    ((item.endMinute - item.startMinute) / 60) * HOUR_HEIGHT - 2,
  );
  const width = 100 / item.lanes;
  const cancelled = item.booking.status === "cancelled";

  return (
    <div
      className={cn(
        "absolute overflow-hidden rounded-md border px-1.5 py-1 text-[0.6875rem] leading-tight",
        cancelled
          ? "border-border bg-surface-muted text-fg-subtle line-through"
          : item.booking.status === "pending"
            ? "border-warning/45 bg-warning-soft text-fg"
            : "border-accent/45 bg-accent-soft text-fg",
      )}
      style={{
        top,
        height,
        left: `calc(${item.lane * width}% + 2px)`,
        width: `calc(${width}% - 4px)`,
      }}
      title={`${item.booking.service_name} — ${item.booking.customer_name}`}
    >
      <p className="truncate font-semibold">
        {formatInBusinessTz(item.booking.starts_at, timezone, "h:mm")} ·{" "}
        {item.booking.customer_name}
      </p>
      {!compact ? (
        <>
          <p className="truncate text-fg-muted">{item.booking.service_name}</p>
          <div className="mt-1">
            <BookingStatusBadge status={item.booking.status} short />
          </div>
        </>
      ) : null}
    </div>
  );
}
