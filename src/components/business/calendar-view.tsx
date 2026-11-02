"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarX2 } from "lucide-react";
import { DateStrip } from "./date-strip";
import { OwnerBookingRow, OwnerBookingSheet } from "./booking-row";
import { MoveBookingSheet } from "./move-booking-sheet";
import { rescheduleBookingAction } from "@/lib/actions/bookings";
import { idleState } from "@/lib/actions/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/misc";
import { BookingStatusBadge } from "@/components/shared/booking-status";
import { useT, useLocale } from "@/lib/i18n/context";
import type { BookingRow, BusinessRow } from "@/lib/database.types";
import {
  formatInBusinessTz,
  formatSlotTime,
  localMinutesFromMidnight,
  minutesToSlotLabel,
  shiftDateKey,
  toDateKey,
  zonedDayMinutesToUtc,
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

/** Sentinel for the staff filter's "show everyone" option — kept out of the
 *  URL param namespace Radix Select's value prop (which rejects ""). */
const ALL_STAFF = "all";

type StaffOption = { id: string; name: string };

export function CalendarView({
  business,
  bookings,
  staff = [],
  selectedDate,
  today,
  view,
  weekStart,
}: {
  business: BusinessRow;
  bookings: Booking[];
  /** Active staff only — this is what the filter offers a choice of. */
  staff?: StaffOption[];
  selectedDate: DateKey;
  today: DateKey;
  view: "day" | "week";
  weekStart: DateKey;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useT();

  const staffFilter = searchParams.get("staff") ?? ALL_STAFF;

  const navigate = (next: { date?: DateKey; view?: "day" | "week"; staff?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.date) params.set("date", next.date);
    if (next.view) params.set("view", next.view);
    if (next.staff) {
      if (next.staff === ALL_STAFF) params.delete("staff");
      else params.set("staff", next.staff);
    }
    router.replace(`/dashboard/calendar?${params.toString()}`, { scroll: false });
  };

  // One barber's own calendar, or every booking — a client-side filter is
  // enough since bookings for the whole visible range are already loaded.
  const filteredBookings = useMemo(
    () => (staffFilter === ALL_STAFF ? bookings : bookings.filter((b) => b.staff_id === staffFilter)),
    [bookings, staffFilter],
  );

  const byDate = useMemo(() => {
    const map: Record<DateKey, Booking[]> = {};
    for (const booking of filteredBookings) {
      const key = toDateKey(new Date(booking.starts_at), business.timezone);
      (map[key] ??= []).push(booking);
    }
    for (const list of Object.values(map)) {
      list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    }
    return map;
  }, [filteredBookings, business.timezone]);

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
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <Tabs
          value={view}
          onValueChange={(value) => navigate({ view: value as "day" | "week" })}
        >
          <TabsList className="w-full max-w-64">
            <TabsTrigger value="day">{t("calendarAdmin.dayTab")}</TabsTrigger>
            <TabsTrigger value="week">{t("calendarAdmin.weekTab")}</TabsTrigger>
          </TabsList>
        </Tabs>

        {staff.length > 0 ? (
          <Select value={staffFilter} onValueChange={(value) => navigate({ staff: value })}>
            <SelectTrigger
              aria-label={t("staffAdmin.calendarFilterLabel")}
              className="h-10 w-auto min-w-40"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STAFF}>{t("staffAdmin.calendarFilterAllLabel")}</SelectItem>
              {staff.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

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
  const t = useT();
  const { locale } = useLocale();
  const live = bookings.filter((b) => b.status !== "cancelled");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold tracking-tight">
          {formatInBusinessTz(`${date}T12:00:00Z`, "UTC", "EEEE d MMMM yyyy", locale)}
        </h2>
        <p className="text-sm text-fg-muted">
          {live.length === 0
            ? t("calendarAdmin.nothingBooked")
            : live.length === 1
              ? t("calendarAdmin.bookingCountOne", { n: live.length })
              : t("calendarAdmin.bookingCountMany", { n: live.length })}
        </p>
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title={t("calendarAdmin.noBookingsTitle")}
          description={t("calendarAdmin.noBookingsDescription")}
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
  const t = useT();
  const { locale } = useLocale();
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold tracking-tight">
        {formatInBusinessTz(`${dates[0]}T12:00:00Z`, "UTC", "d MMM", locale)} –{" "}
        {formatInBusinessTz(`${dates[6]}T12:00:00Z`, "UTC", "d MMM yyyy", locale)}
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
                  date === today ? "text-accent-ink" : "text-fg",
                )}
              >
                <span className="text-sm font-semibold">
                  {formatInBusinessTz(`${date}T12:00:00Z`, "UTC", "EEEE d MMM", locale)}
                  {date === today ? t("calendarAdmin.todaySuffix") : ""}
                </span>
                <span className="text-xs font-semibold text-fg-subtle">
                  {list.length === 0 ? t("calendarAdmin.free") : `${list.length}`}
                </span>
              </button>

              {list.length === 0 ? (
                <p className="rounded-lg border border-border px-3 py-3 text-sm text-fg-subtle">
                  {t("calendarAdmin.nothingBooked")}
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

/* -------------------------------------------------------------------------- */
/* Timeline grids                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Sheet state and the drop handler shared by both grids.
 *
 * Dropping calls the same Server Action the move sheet uses, so a dragged
 * booking is re-validated against hours, breaks and other bookings exactly
 * like any other reschedule. The grid never trusts its own arithmetic.
 */
function useGridActions() {
  const router = useRouter();
  const t = useT();
  const [active, setActive] = useState<Booking | null>(null);
  const [moving, setMoving] = useState<Booking | null>(null);

  const onDrop = useCallback(
    async (booking: Booking, startsAtIso: string) => {
      const formData = new FormData();
      formData.set("id", booking.id);
      formData.set("startsAt", startsAtIso);
      const result = await rescheduleBookingAction(idleState, formData);
      if (result.status === "error") {
        toast.error(result.message ?? t("common.couldNotMoveBooking"));
      } else {
        toast.success(result.message ?? t("common.bookingMoved"));
      }
      router.refresh();
    },
    [router, t],
  );

  return { active, setActive, moving, setMoving, onDrop };
}

function GridSheets({
  business,
  actions,
}: {
  business: BusinessRow;
  actions: ReturnType<typeof useGridActions>;
}) {
  const { active, setActive, moving, setMoving } = actions;
  return (
    <>
      {active ? (
        <OwnerBookingSheet
          key={active.id}
          booking={active}
          timezone={business.timezone}
          open
          onOpenChange={(open) => !open && setActive(null)}
          onMove={() => {
            setMoving(active);
            setActive(null);
          }}
        />
      ) : null}
      {moving ? (
        <MoveBookingSheet
          key={moving.id}
          booking={moving}
          timezone={business.timezone}
          open
          onOpenChange={(open) => !open && setMoving(null)}
        />
      ) : null}
    </>
  );
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
  const actions = useGridActions();
  const t = useT();

  return (
    <>
      <div className="flex gap-2 overflow-hidden rounded-xl border border-border bg-surface p-3">
        <HourGutter startMinute={startMinute} hours={hours} />
        <div className="relative flex-1" data-date={date} style={{ height: hours * HOUR_HEIGHT }}>
          <HourLines hours={hours} />
          {positioned.map((item) => (
            <BookingBlock
              key={item.booking.id}
              item={item}
              gridStart={startMinute}
              date={date}
              business={business}
              onOpen={() => actions.setActive(item.booking)}
              onDrop={actions.onDrop}
            />
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-fg-subtle">{t("calendarAdmin.dragHintDay")}</p>
      <GridSheets business={business} actions={actions} />
    </>
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
  const actions = useGridActions();
  const t = useT();
  const { locale } = useLocale();

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] border-b border-border">
          <span />
          {dates.map((date) => (
            <span
              key={date}
              className={cn(
                "border-l border-border px-2 py-2 text-center text-xs font-semibold",
                date === today ? "bg-accent-soft text-accent-ink" : "text-fg-muted",
              )}
            >
              <span className="block">
                {formatInBusinessTz(`${date}T12:00:00Z`, "UTC", "EEE", locale)}
              </span>
              <span className="block text-base font-bold tabular-nums text-fg">
                {formatInBusinessTz(`${date}T12:00:00Z`, "UTC", "d", locale)}
              </span>
            </span>
          ))}
        </div>

        <div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] p-2 pl-0">
          <HourGutter startMinute={startMinute} hours={hours} />
          {dates.map((date) => {
            const positioned = layout(byDate[date] ?? [], business.timezone, date);
            return (
              <div
                key={date}
                data-date={date}
                className="relative border-l border-border"
                style={{ height: hours * HOUR_HEIGHT }}
              >
                <HourLines hours={hours} />
                {positioned.map((item) => (
                  <BookingBlock
                    key={item.booking.id}
                    item={item}
                    gridStart={startMinute}
                    date={date}
                    business={business}
                    onOpen={() => actions.setActive(item.booking)}
                    onDrop={actions.onDrop}
                    compact
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-xs text-fg-subtle">{t("calendarAdmin.dragHintWeek")}</p>
      <GridSheets business={business} actions={actions} />
    </>
  );
}

function HourGutter({ startMinute, hours }: { startMinute: number; hours: number }) {
  const { locale } = useLocale();
  return (
    <div className="w-16 shrink-0" style={{ height: hours * HOUR_HEIGHT }}>
      {Array.from({ length: hours }, (_, index) => (
        <div
          key={index}
          className="relative text-right text-xs font-medium text-fg-subtle"
          style={{ height: HOUR_HEIGHT }}
        >
          <span className="num absolute right-2 -top-1.5 whitespace-nowrap">
            {minutesToSlotLabel(startMinute + index * 60, locale)}
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

const DRAG_THRESHOLD_PX = 4;

/**
 * One booking on the timeline.
 *
 * Mouse and pen can drag it; the drop snaps to the shop's slot interval and
 * lands in whichever day column is under the pointer. Touch never drags —
 * a finger on a scrolling grid should scroll it — so on a phone a tap opens
 * the sheet and "Move" lives in there.
 */
function BookingBlock({
  item,
  gridStart,
  date,
  business,
  onOpen,
  onDrop,
  compact,
}: {
  item: Positioned;
  gridStart: number;
  date: DateKey;
  business: BusinessRow;
  onOpen: () => void;
  onDrop: (booking: Booking, startsAtIso: string) => Promise<void>;
  compact?: boolean;
}) {
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const gesture = useRef<{ x: number; y: number; moved: boolean; drags: boolean } | null>(null);

  const status = item.booking.status;
  const live = status === "pending" || status === "confirmed";
  const cancelled = status === "cancelled";

  const top = ((item.startMinute - gridStart) / 60) * HOUR_HEIGHT;
  const height = Math.max(22, ((item.endMinute - item.startMinute) / 60) * HOUR_HEIGHT - 2);
  const width = 100 / item.lanes;
  // Too short for service + status: show the one "time · name" line (details stay in the title and sheet).
  const oneLine = compact || height < 48;
  const { locale } = useLocale();

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const drags = live && event.pointerType !== "touch";
    gesture.current = { x: event.clientX, y: event.clientY, moved: false, drags };
    if (drags) event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || !g.drags) return;
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    g.moved = true;
    setOffset({ x: dx, y: dy });
  };

  const onPointerUp = async (event: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.drags) event.currentTarget.releasePointerCapture(event.pointerId);

    if (!g.moved) {
      setOffset(null);
      onOpen();
      return;
    }

    const dy = event.clientY - g.y;
    const rawMinute = item.startMinute + (dy / HOUR_HEIGHT) * 60;
    const step = business.slot_interval_min;
    const minute = Math.max(0, Math.round(rawMinute / step) * step);

    const column = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-date]");
    const targetDate = column?.dataset.date ?? date;

    if (minute === item.startMinute && targetDate === date) {
      setOffset(null);
      return;
    }

    setSaving(true);
    await onDrop(
      item.booking,
      zonedDayMinutesToUtc(targetDate, minute, business.timezone).toISOString(),
    );
    setSaving(false);
    setOffset(null);
  };

  const onPointerCancel = () => {
    gesture.current = null;
    setOffset(null);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "absolute overflow-hidden rounded-md border px-1.5 py-1 text-xs leading-tight",
        "select-none outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        live ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        offset && "z-20 shadow-[var(--shadow-float)] opacity-90",
        saving && "opacity-50",
        cancelled
          ? "border-border bg-surface-muted text-fg-subtle line-through"
          : status === "pending"
            ? "border-warning/45 bg-warning-soft text-fg"
            : "border-accent/45 bg-accent-soft text-fg",
      )}
      style={{
        top,
        height,
        left: `calc(${item.lane * width}% + 2px)`,
        width: `calc(${width}% - 4px)`,
        transform: offset ? `translate(${offset.x}px, ${offset.y}px)` : undefined,
        touchAction: "pan-y",
      }}
      title={`${item.booking.service_name} — ${item.booking.customer_name}`}
    >
      <p className="truncate font-semibold">
        {formatSlotTime(item.booking.starts_at, business.timezone, locale)} ·{" "}
        {item.booking.customer_name}
      </p>
      {!oneLine ? (
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
