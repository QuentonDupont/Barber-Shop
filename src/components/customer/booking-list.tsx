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
import { formatInBusinessTz, formatMoney, formatSlotTime } from "@/lib/booking/time";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/i18n/context";
import { businessPath } from "@/lib/routes";

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
  const { locale } = useLocale();
  const t = useT();
  const timezone = booking.business?.timezone ?? "Asia/Bangkok";
  const past = booking.status === "cancelled" || new Date(booking.ends_at) < new Date();

  return (
    <button
      type="button"
      onClick={() => onOpen(booking)}
      className={cn(
        "appt-press flex w-full items-start gap-3 rounded-[var(--radius-panel)] border border-border bg-surface p-4 text-left",
        "hover:border-border-strong outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        past && "opacity-70",
      )}
    >
      <span className="flex w-14 shrink-0 flex-col items-center rounded-2xl bg-surface-muted py-2">
        <span className="text-xs font-semibold text-fg-muted">
          {formatInBusinessTz(booking.starts_at, timezone, "MMM", locale)}
        </span>
        <span className="text-xl font-bold leading-none tabular-nums">
          {formatInBusinessTz(booking.starts_at, timezone, "d")}
        </span>
        <span className="mt-0.5 text-xs font-medium text-fg-muted">
          {formatInBusinessTz(booking.starts_at, timezone, "EEE", locale)}
        </span>
      </span>

      <span className="min-w-0 flex-1 space-y-1">
        <span className="block truncate font-semibold">
          {booking.business?.name ?? t("bookingDetail.business")}
        </span>
        <span className="block truncate text-sm text-fg-muted">
          {booking.service_name} ·{" "}
          {formatSlotTime(booking.starts_at, timezone, locale)}
          {booking.staff_name ? ` · ${booking.staff_name}` : ""}
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
  const { locale } = useLocale();
  const t = useT();

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? t("bookingDetail.cancelledFallback"));
      onClose();
    }
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state, onClose, t]);

  if (!booking) return null;

  const timezone = booking.business?.timezone ?? "Asia/Bangkok";
  const cancellable =
    (booking.status === "pending" || booking.status === "confirmed") &&
    new Date(booking.starts_at) > new Date();

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{booking.business?.name ?? t("bookingDetail.yourBooking")}</SheetTitle>
          <SheetDescription>
            {formatInBusinessTz(booking.starts_at, timezone, "EEEE d MMMM yyyy", locale)} ·{" "}
            {formatSlotTime(booking.starts_at, timezone, locale)} –{" "}
            {formatSlotTime(booking.ends_at, timezone, locale)}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={booking.status} />
            <span className="text-sm font-semibold">
              {formatMoney(booking.price, booking.currency)}
            </span>
          </div>

          <dl className="divide-y divide-border rounded-[var(--radius-panel)] bg-surface-muted px-4">
            <div className="flex items-start justify-between gap-4 py-3">
              <dt className="text-sm text-fg-muted">{t("bookingDetail.service")}</dt>
              <dd className="text-right font-semibold">{booking.service_name}</dd>
            </div>
            {booking.staff_name ? (
              <div className="flex items-start justify-between gap-4 py-3">
                <dt className="text-sm text-fg-muted">{t("bookingDetail.barber")}</dt>
                <dd className="text-right font-semibold">{booking.staff_name}</dd>
              </div>
            ) : null}
            <div className="flex items-start justify-between gap-4 py-3">
              <dt className="text-sm text-fg-muted">{t("bookingDetail.timeZone")}</dt>
              <dd className="text-right font-semibold">{timezone}</dd>
            </div>
            {booking.notes ? (
              <div className="flex items-start justify-between gap-4 py-3">
                <dt className="shrink-0 text-sm text-fg-muted">{t("bookingDetail.yourNote")}</dt>
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
                <MapPin className="size-4 shrink-0 text-fg-muted" />
                <span className="truncate">{booking.business.address}</span>
              </a>
            ) : null}

            {booking.business?.phone ? (
              <a
                href={`tel:${booking.business.phone.replace(/\s/g, "")}`}
                className="inline-flex min-h-12 items-center gap-2.5 rounded-lg border border-border px-3.5 text-sm font-medium transition-colors hover:bg-surface-muted"
              >
                <Phone className="size-4 shrink-0 text-fg-muted" />
                {t("bookingDetail.call", { phone: booking.business.phone })}
              </a>
            ) : null}

            {booking.business ? (
              <Link
                href={businessPath(booking.business.slug)}
                className="inline-flex min-h-12 items-center gap-2.5 rounded-lg border border-border px-3.5 text-sm font-medium transition-colors hover:bg-surface-muted"
              >
                <Repeat2 className="size-4 shrink-0 text-fg-muted" />
                {t("bookingDetail.bookAgain")}
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
  const t = useT();
  return (
    <Button type="submit" size="lg" block variant="outline" loading={pending} className="text-danger">
      <X />
      {t("bookingDetail.cancelBooking")}
    </Button>
  );
}

export { CalendarClock };
