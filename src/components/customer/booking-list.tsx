"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import Link from "next/link";
import { CalendarClock, MapPin, Phone, Repeat2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingStatusBadge } from "@/components/shared/booking-status";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cancelBookingAction } from "@/lib/actions/bookings";
import { idleState } from "@/lib/actions/types";
import type { BookingRow } from "@/lib/database.types";
import { formatInBusinessTz, formatMoney } from "@/lib/booking/time";
import { cn } from "@/lib/utils";

export interface CustomerBooking extends BookingRow {
  business: {
    name: string;
    slug: string;
    timezone: string;
    address: string | null;
    phone: string | null;
  } | null;
}

export function BookingList({
  bookings,
  emptyState,
}: {
  bookings: CustomerBooking[];
  emptyState: React.ReactNode;
}) {
  const [open, setOpen] = useState<CustomerBooking | null>(null);

  if (bookings.length === 0) return <>{emptyState}</>;

  return (
    <>
      <div className="space-y-2.5">
        {bookings.map((booking) => (
          <BookingCard key={booking.id} booking={booking} onOpen={setOpen} />
        ))}
      </div>

      <DetailSheet
        key={open?.id ?? "closed"}
        booking={open}
        onClose={() => setOpen(null)}
      />
    </>
  );
}

function BookingCard({
  booking,
  onOpen,
}: {
  booking: CustomerBooking;
  onOpen: (booking: CustomerBooking) => void;
}) {
  const timezone = booking.business?.timezone ?? "Asia/Bangkok";
  const past = booking.status === "cancelled" || new Date(booking.ends_at) < new Date();

  return (
    <button
      type="button"
      onClick={() => onOpen(booking)}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border border-border bg-surface p-3.5 text-left",
        "transition-colors hover:bg-surface-muted outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        past && "opacity-70",
      )}
    >
      <span className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-surface-muted py-2">
        <span className="text-[0.625rem] font-semibold uppercase text-fg-subtle">
          {formatInBusinessTz(booking.starts_at, timezone, "MMM")}
        </span>
        <span className="text-xl font-bold leading-none tabular-nums">
          {formatInBusinessTz(booking.starts_at, timezone, "d")}
        </span>
        <span className="mt-0.5 text-[0.625rem] font-medium text-fg-subtle">
          {formatInBusinessTz(booking.starts_at, timezone, "EEE")}
        </span>
      </span>

      <span className="min-w-0 flex-1 space-y-1">
        <span className="block truncate font-semibold">
          {booking.business?.name ?? "Business"}
        </span>
        <span className="block truncate text-sm text-fg-muted">
          {booking.service_name} ·{" "}
          {formatInBusinessTz(booking.starts_at, timezone, "h:mm a")}
        </span>
        <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <BookingStatusBadge status={booking.status} short />
          <Badge tone="neutral">{formatMoney(booking.price, booking.currency)}</Badge>
        </span>
      </span>
    </button>
  );
}

function DetailSheet({
  booking,
  onClose,
}: {
  booking: CustomerBooking | null;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(cancelBookingAction, idleState);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Cancelled.");
      onClose();
    }
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state, onClose]);

  if (!booking) return null;

  const timezone = booking.business?.timezone ?? "Asia/Bangkok";
  const cancellable =
    (booking.status === "pending" || booking.status === "confirmed") &&
    new Date(booking.starts_at) > new Date();

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{booking.business?.name ?? "Your booking"}</SheetTitle>
          <SheetDescription>
            {formatInBusinessTz(booking.starts_at, timezone, "EEEE d MMMM yyyy")} ·{" "}
            {formatInBusinessTz(booking.starts_at, timezone, "h:mm a")} –{" "}
            {formatInBusinessTz(booking.ends_at, timezone, "h:mm a")}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={booking.status} />
            <span className="text-sm font-semibold">
              {formatMoney(booking.price, booking.currency)}
            </span>
          </div>

          <dl className="divide-y divide-border rounded-xl bg-surface-muted px-3.5">
            <div className="flex items-start justify-between gap-4 py-3">
              <dt className="text-sm text-fg-muted">Service</dt>
              <dd className="text-right font-semibold">{booking.service_name}</dd>
            </div>
            <div className="flex items-start justify-between gap-4 py-3">
              <dt className="text-sm text-fg-muted">Time zone</dt>
              <dd className="text-right font-semibold">{timezone}</dd>
            </div>
            {booking.notes ? (
              <div className="flex items-start justify-between gap-4 py-3">
                <dt className="shrink-0 text-sm text-fg-muted">Your note</dt>
                <dd className="text-right text-sm text-fg-muted text-pretty">
                  {booking.notes}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="flex flex-col gap-2">
            {booking.business?.address ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.business.address)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center gap-2.5 rounded-lg border border-border px-3.5 text-sm font-medium transition-colors hover:bg-surface-muted"
              >
                <MapPin className="size-4 shrink-0 text-accent" />
                <span className="truncate">{booking.business.address}</span>
              </a>
            ) : null}

            {booking.business?.phone ? (
              <a
                href={`tel:${booking.business.phone.replace(/\s/g, "")}`}
                className="inline-flex min-h-12 items-center gap-2.5 rounded-lg border border-border px-3.5 text-sm font-medium transition-colors hover:bg-surface-muted"
              >
                <Phone className="size-4 shrink-0 text-accent" />
                Call {booking.business.phone}
              </a>
            ) : null}

            {booking.business ? (
              <Link
                href={`/app/b/${booking.business.slug}`}
                className="inline-flex min-h-12 items-center gap-2.5 rounded-lg border border-border px-3.5 text-sm font-medium transition-colors hover:bg-surface-muted"
              >
                <Repeat2 className="size-4 shrink-0 text-accent" />
                Book again
              </Link>
            ) : null}
          </div>
        </SheetBody>

        {cancellable ? (
          <SheetFooter>
            <form action={formAction} className="w-full">
              <input type="hidden" name="id" value={booking.id} />
              <CancelButton />
            </form>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function CancelButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block variant="outline" loading={pending} className="text-danger">
      <X />
      Cancel this booking
    </Button>
  );
}

export { CalendarClock };
