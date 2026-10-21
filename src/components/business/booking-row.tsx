"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  Ban,
  CalendarClock,
  Check,
  CircleSlash,
  MessageSquare,
  MoreVertical,
  NotebookPen,
  Phone,
  UserRound,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
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
import { updateBookingStatusAction } from "@/lib/actions/bookings";
import { getCustomerNote, saveCustomerNoteAction } from "@/lib/actions/customer-notes";
import { MoveBookingSheet } from "./move-booking-sheet";
import { idleState } from "@/lib/actions/types";
import type { BookingRow, BookingStatus } from "@/lib/database.types";
import { formatInBusinessTz, formatMoney } from "@/lib/booking/time";
import { cn } from "@/lib/utils";

export type OwnerBooking = Pick<
  BookingRow,
  | "id"
  | "customer_id"
  | "starts_at"
  | "ends_at"
  | "status"
  | "service_name"
  | "customer_name"
  | "customer_phone"
  | "notes"
  | "price"
  | "currency"
>;

/**
 * One booking in the owner's list.
 *
 * The whole row is the tap target on a phone — it opens a sheet with every
 * action at the bottom of the screen, rather than asking for a precise hit on
 * a small overflow button.
 */
export function OwnerBookingRow({
  booking,
  timezone,
  className,
}: {
  booking: OwnerBooking;
  timezone: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const live = booking.status === "pending" || booking.status === "confirmed";

  return (
    <>
      <div
        className={cn(
          "flex items-stretch gap-3 rounded-xl border border-border bg-surface p-3 sm:p-3.5",
          booking.status === "cancelled" && "opacity-60",
          className,
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-lg"
        >
          <span className="flex w-16 shrink-0 flex-col items-center rounded-lg bg-surface-muted px-1 py-2 sm:w-20">
            <span className="text-sm font-bold tabular-nums sm:text-base">
              {formatInBusinessTz(booking.starts_at, timezone, "h:mm")}
            </span>
            <span className="text-[0.625rem] font-semibold uppercase text-fg-subtle">
              {formatInBusinessTz(booking.starts_at, timezone, "a")}
            </span>
          </span>

          <span className="min-w-0 flex-1 space-y-1">
            <span className="block truncate font-semibold">{booking.service_name}</span>
            <span className="flex items-center gap-1.5 text-sm text-fg-muted">
              <UserRound className="size-3.5 shrink-0" />
              <span className="truncate">{booking.customer_name}</span>
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              <BookingStatusBadge status={booking.status} short />
              <span className="text-xs text-fg-subtle">
                until {formatInBusinessTz(booking.ends_at, timezone, "h:mm a")}
              </span>
            </span>
          </span>
        </button>

        {live ? (
          <QuickActions bookingId={booking.id} status={booking.status} />
        ) : null}
      </div>

      <OwnerBookingSheet
        booking={booking}
        timezone={timezone}
        open={open}
        onOpenChange={setOpen}
        onMove={() => {
          setOpen(false);
          setMoving(true);
        }}
      />
      {live ? (
        <MoveBookingSheet
          key={moving ? "open" : "closed"}
          booking={booking}
          timezone={timezone}
          open={moving}
          onOpenChange={setMoving}
        />
      ) : null}
    </>
  );
}

/** Desktop-friendly overflow menu; hidden on phones where the sheet rules. */
function QuickActions({ bookingId, status }: { bookingId: string; status: BookingStatus }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="hidden size-9 shrink-0 items-center justify-center self-center rounded-lg text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg sm:flex"
          aria-label="Booking actions"
        >
          <MoreVertical className="size-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-48 rounded-xl border border-border bg-surface p-1.5 shadow-[var(--shadow-raised)]"
        >
          {status === "pending" ? (
            <StatusMenuItem id={bookingId} status="confirmed" icon={Check}>
              Confirm
            </StatusMenuItem>
          ) : null}
          <StatusMenuItem id={bookingId} status="completed" icon={Check}>
            Mark completed
          </StatusMenuItem>
          <StatusMenuItem id={bookingId} status="no_show" icon={CircleSlash}>
            Mark no-show
          </StatusMenuItem>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <StatusMenuItem id={bookingId} status="cancelled" icon={Ban} danger>
            Cancel booking
          </StatusMenuItem>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function StatusMenuItem({
  id,
  status,
  icon: Icon,
  danger,
  children,
}: {
  id: string;
  status: BookingStatus;
  icon: React.ComponentType<{ className?: string }>;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const [, formAction] = useActionState(withToast(updateBookingStatusAction), idleState);
  return (
    <DropdownMenu.Item asChild>
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value={status} />
        <button
          type="submit"
          className={cn(
            "flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm outline-none",
            danger ? "text-danger hover:bg-danger-soft" : "hover:bg-surface-muted",
          )}
        >
          <Icon className="size-4" />
          {children}
        </button>
      </form>
    </DropdownMenu.Item>
  );
}

/**
 * The owner's view of one booking, with every action under the thumb.
 * Exported so the calendar grid can open it for a tapped block.
 */
export function OwnerBookingSheet({
  booking,
  timezone,
  open,
  onOpenChange,
  onMove,
}: {
  booking: OwnerBooking;
  timezone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMove?: () => void;
}) {
  const [, formAction] = useActionState(withToast(updateBookingStatusAction), idleState);
  const live = booking.status === "pending" || booking.status === "confirmed";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{booking.service_name}</SheetTitle>
          <SheetDescription>
            {formatInBusinessTz(booking.starts_at, timezone, "EEEE d MMMM")} ·{" "}
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

          <dl className="space-y-3 rounded-xl bg-surface-muted p-3.5 text-sm">
            <div className="flex items-start gap-2.5">
              <UserRound className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
              <div className="min-w-0">
                <dt className="sr-only">Customer</dt>
                <dd className="font-semibold">{booking.customer_name}</dd>
              </div>
            </div>

            {booking.customer_phone ? (
              <div className="flex items-start gap-2.5">
                <Phone className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                <div className="min-w-0">
                  <dt className="sr-only">Phone</dt>
                  <dd>
                    <a
                      href={`tel:${booking.customer_phone.replace(/\s/g, "")}`}
                      className="font-semibold text-accent hover:underline"
                    >
                      {booking.customer_phone}
                    </a>
                  </dd>
                </div>
              </div>
            ) : null}

            {booking.notes ? (
              <div className="flex items-start gap-2.5">
                <MessageSquare className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                <div className="min-w-0">
                  <dt className="sr-only">Notes</dt>
                  <dd className="text-fg-muted text-pretty">{booking.notes}</dd>
                </div>
              </div>
            ) : null}
          </dl>

          {/* Simple client records (roadmap.md §1 row 5): a note that follows
              this customer across every booking at this business, not just
              the one-off note above tied to a single booking. Never shown to
              the customer — see the RLS policy in the matching migration. */}
          <CustomerNoteSection customerId={booking.customer_id} open={open} />
        </SheetBody>

        {live ? (
          <SheetFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              <form action={formAction} className="contents">
                <input type="hidden" name="id" value={booking.id} />
                <input type="hidden" name="status" value="cancelled" />
                <CancelButton />
              </form>
              {onMove ? (
                <Button type="button" size="md" variant="ghost" onClick={onMove}>
                  <CalendarClock />
                  Move
                </Button>
              ) : null}
            </div>

            <div className="flex gap-2">
              {booking.status === "pending" ? (
                <form action={formAction} className="flex-1">
                  <input type="hidden" name="id" value={booking.id} />
                  <input type="hidden" name="status" value="confirmed" />
                  <SubmitButton variant="accent">
                    <Check />
                    Confirm
                  </SubmitButton>
                </form>
              ) : (
                <>
                  <form action={formAction} className="flex-1">
                    <input type="hidden" name="id" value={booking.id} />
                    <input type="hidden" name="status" value="no_show" />
                    <SubmitButton variant="outline">No-show</SubmitButton>
                  </form>
                  <form action={formAction} className="flex-1">
                    <input type="hidden" name="id" value={booking.id} />
                    <input type="hidden" name="status" value="completed" />
                    <SubmitButton variant="primary">
                      <Check />
                      Done
                    </SubmitButton>
                  </form>
                </>
              )}
            </div>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Loads the customer's standing note (if any) once the sheet is actually
 * open, rather than on every booking row render — a sheet that's never
 * opened never costs a lookup.
 */
function CustomerNoteSection({ customerId, open }: { customerId: string; open: boolean }) {
  const [initialNote, setInitialNote] = useState<string | null>(null);
  const [, formAction] = useActionState(withToast(saveCustomerNoteAction), idleState);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getCustomerNote(customerId).then((note) => {
      if (!cancelled) setInitialNote(note);
    });
    return () => {
      cancelled = true;
    };
  }, [open, customerId]);

  if (initialNote === null) {
    return (
      <div className="flex items-center gap-2.5 text-sm text-fg-subtle">
        <NotebookPen className="size-4 shrink-0" />
        Loading customer notes…
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="customerId" value={customerId} />
      <label htmlFor="customerNote" className="flex items-center gap-2 text-sm font-medium">
        <NotebookPen className="size-4 shrink-0 text-fg-subtle" />
        Customer notes
      </label>
      <Textarea
        id="customerNote"
        name="note"
        defaultValue={initialNote}
        maxLength={2000}
        placeholder="Usual cut, preferences, allergies…"
        className="min-h-20"
      />
      <div className="flex justify-end">
        <SaveNoteButton />
      </div>
    </form>
  );
}

function SaveNoteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" loading={pending}>
      Save note
    </Button>
  );
}

function SubmitButton({
  variant,
  children,
}: {
  variant: "accent" | "primary" | "outline";
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="md" block variant={variant} loading={pending}>
      {children}
    </Button>
  );
}

function CancelButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="md" variant="ghost" loading={pending} className="text-danger">
      <Ban />
      Cancel booking
    </Button>
  );
}

/** Surfaces an action's result as a toast without every caller repeating it. */
function withToast<T extends { status: string; message?: string }>(
  action: (prev: T, formData: FormData) => Promise<T>,
) {
  return async (prev: T, formData: FormData): Promise<T> => {
    const result = await action(prev, formData);
    if (result.status === "error" && result.message) toast.error(result.message);
    if (result.status === "success" && result.message) toast.success(result.message);
    return result;
  };
}
