"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { CalendarX2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { DateStrip } from "./date-strip";
import {
  getMoveOptionsAction,
  rescheduleBookingAction,
  type MoveOption,
} from "@/lib/actions/bookings";
import { idleState } from "@/lib/actions/types";
import { businessToday, formatInBusinessTz, toDateKey, type DateKey } from "@/lib/booking/time";
import { cn } from "@/lib/utils";

interface MovableBooking {
  id: string;
  service_name: string;
  customer_name: string;
  starts_at: string;
  ends_at: string;
}

/**
 * Reschedule without dragging.
 *
 * Works the same with a thumb as with a mouse: flick to a day, tap a time,
 * confirm. The candidate times come from the same engine that serves
 * customers, minus the booking's own slot, and the server re-checks the pick
 * before anything is written.
 */
export function MoveBookingSheet({
  booking,
  timezone,
  open,
  onOpenChange,
}: {
  booking: MovableBooking;
  timezone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const today = businessToday(timezone);
  const currentDate = toDateKey(new Date(booking.starts_at), timezone);

  const [date, setDate] = useState<DateKey>(currentDate);
  const [slots, setSlots] = useState<MoveOption[] | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [choice, setChoice] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [state, formAction] = useActionState(rescheduleBookingAction, idleState);

  useEffect(() => {
    if (!open) return;
    setChoice(null);
    setSlots(null);
    startLoading(async () => {
      const result = await getMoveOptionsAction(booking.id, date);
      if (result.status === "error") {
        toast.error(result.message);
        setSlots([]);
        setIsOpen(false);
        return;
      }
      setIsOpen(result.isOpen);
      setSlots(result.slots);
    });
  }, [open, date, booking.id]);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Booking moved.");
      onOpenChange(false);
    }
    if (state.status === "error" && state.message) {
      toast.error(state.message);
      // The slot may have been taken since it was listed — refetch.
      setChoice(null);
      startLoading(async () => {
        const result = await getMoveOptionsAction(booking.id, date);
        if (result.status === "ok") setSlots(result.slots);
      });
    }
  }, [state, onOpenChange, booking.id, date]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Move booking</SheetTitle>
          <SheetDescription>
            {booking.customer_name} · {booking.service_name} · currently{" "}
            {formatInBusinessTz(booking.starts_at, timezone, "EEE d MMM, h:mm a")}
          </SheetDescription>
        </SheetHeader>

        <form action={formAction}>
          <input type="hidden" name="id" value={booking.id} />
          <input type="hidden" name="startsAt" value={choice ?? ""} />

          <SheetBody>
            <DateStrip selected={date} today={today} onSelect={setDate} days={28} />

            <p className="text-sm font-semibold">
              {formatInBusinessTz(`${date}T12:00:00Z`, "UTC", "EEEE d MMMM")}
            </p>

            {loading || slots === null ? (
              <div className="flex min-h-28 items-center justify-center gap-2 rounded-xl border border-border text-sm text-fg-muted">
                <Loader2 className="size-4 animate-spin" />
                Checking availability…
              </div>
            ) : !isOpen ? (
              <EmptyState
                icon={CalendarX2}
                title="Closed that day"
                description="Pick another date, or change your hours first."
              />
            ) : slots.length === 0 ? (
              <EmptyState
                icon={CalendarX2}
                title="No free times that day"
                description="Every slot is taken. Try a neighbouring day."
              />
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => {
                  const active = slot.startsAt === choice;
                  const isCurrent = slot.startsAt === booking.starts_at;
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      onClick={() => setChoice(active ? null : slot.startsAt)}
                      aria-pressed={active}
                      className={cn(
                        "min-h-12 rounded-lg border text-sm font-semibold tabular-nums transition-colors",
                        "outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                        active
                          ? "border-accent bg-accent text-accent-fg"
                          : isCurrent
                            ? "border-accent/50 bg-accent-soft text-accent"
                            : "border-border bg-surface hover:border-accent/50 hover:bg-accent-soft",
                      )}
                    >
                      {slot.label}
                      {isCurrent ? <span className="sr-only"> (current time)</span> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </SheetBody>

          <SheetFooter>
            <Button type="button" variant="ghost" size="md" onClick={() => onOpenChange(false)}>
              Keep as is
            </Button>
            <MoveButton disabled={!choice || choice === booking.starts_at} />
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function MoveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant="accent" loading={pending} disabled={disabled} className="sm:w-auto">
      Move booking
    </Button>
  );
}
