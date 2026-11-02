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
  Undo2,
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
import { canMarkNoShow } from "@/lib/booking/no-show";
import { idleState } from "@/lib/actions/types";
import type { BookingRow, BookingStatus } from "@/lib/database.types";
import { formatInBusinessTz, formatMoney, formatSlotTime } from "@/lib/booking/time";
import { useT, useLocale } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export type OwnerBooking = Pick<
  BookingRow,
  | "id"
  | "customer_id"
  | "starts_at"
  | "ends_at"
  | "status"
  | "source"
  | "service_name"
  | "customer_name"
  | "customer_phone"
  | "notes"
  | "price"
  | "currency"
> & { staff_name?: string | null };

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
  framed = true,
}: {
  booking: OwnerBooking;
  timezone: string;
  className?: string;
  /** `false` inside a panel that already draws the frame and row rules. */
  framed?: boolean;
}) {
  const t = useT();
  const { locale } = useLocale();
  const th = locale === "th";
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const live = booking.status === "pending" || booking.status === "confirmed";
  // Re-evaluated on each render; the server action and the database check the
  // same rule again, so a stale button can only produce a polite error.
  const noShowAllowed = canMarkNoShow(booking);

  return (
    <>
      <div
        data-testid="owner-booking-row"
        data-booking-id={booking.id}
        data-status={booking.status}
        className={cn(
          "flex min-h-[72px] items-stretch gap-3 px-4 py-3.5",
          framed && "rounded-[var(--radius-panel)] border border-border bg-surface",
          booking.status === "cancelled" && "text-fg-muted",
          className,
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="w-16 shrink-0">
            <span className="num block text-[17px] font-semibold leading-snug">
              {formatInBusinessTz(booking.starts_at, timezone, th ? "HH:mm" : "h:mm", locale)}
            </span>
            {th ? null : (
              <span className="block text-xs text-fg-muted">
                {formatInBusinessTz(booking.starts_at, timezone, "a", locale)}
              </span>
            )}
          </span>

          <span className="min-w-0 flex-1 space-y-0.5">
            <span className="block truncate text-[15px] font-semibold">{booking.service_name}</span>
            <span className="block truncate text-sm text-fg-muted">
              {booking.customer_name}
              {booking.staff_name ? ` · ${booking.staff_name}` : ""}
            </span>
            <span className="flex flex-wrap items-center gap-2 pt-1">
              <BookingStatusBadge status={booking.status} short />
              <span className="num text-[13px] text-fg-muted">
                {t("bookingAdmin.untilTime", {
                  time: formatSlotTime(booking.ends_at, timezone, locale),
                })}
              </span>
            </span>
          </span>
        </button>

        {noShowAllowed ? <QuickNoShow bookingId={booking.id} /> : null}
        {live ? (
          <QuickActions
            bookingId={booking.id}
            status={booking.status}
            noShowAllowed={noShowAllowed}
          />
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

/**
 * One-tap no-show, visible on phones too (the overflow menu below is
 * desktop-only). Shown only once the appointment time has passed.
 */
function QuickNoShow({ bookingId }: { bookingId: string }) {
  const t = useT();
  const [, formAction] = useActionState(withToast(updateBookingStatusAction), idleState);
  return (
    <form action={formAction} className="flex shrink-0 items-center">
      <input type="hidden" name="id" value={bookingId} />
      <input type="hidden" name="status" value="no_show" />
      <NoShowQuickButton label={t("bookingAdmin.noShowQuick")} />
    </form>
  );
}

function NoShowQuickButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant="outline"
      loading={pending}
      data-testid="booking-no-show-quick"
    >
      <CircleSlash />
      {label}
    </Button>
  );
}

/** Desktop-friendly overflow menu; hidden on phones where the sheet rules. */
function QuickActions({
  bookingId,
  status,
  noShowAllowed,
}: {
  bookingId: string;
  status: BookingStatus;
  noShowAllowed: boolean;
}) {
  const t = useT();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="hidden size-9 shrink-0 items-center justify-center self-center rounded-full text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg sm:flex"
          aria-label={t("bookingAdmin.bookingActionsLabel")}
        >
          <MoreVertical className="size-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="animate-pop-in z-50 min-w-48 rounded-2xl bg-surface p-1.5 shadow-[var(--shadow-float)]"
        >
          {status === "pending" ? (
            <StatusMenuItem id={bookingId} status="confirmed" icon={Check}>
              {t("bookingAdmin.confirm")}
            </StatusMenuItem>
          ) : null}
          <StatusMenuItem id={bookingId} status="completed" icon={Check}>
            {t("bookingAdmin.markCompleted")}
          </StatusMenuItem>
          {noShowAllowed ? (
            <StatusMenuItem id={bookingId} status="no_show" icon={CircleSlash}>
              {t("bookingAdmin.markNoShow")}
            </StatusMenuItem>
          ) : null}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <StatusMenuItem id={bookingId} status="cancelled" icon={Ban} danger>
            {t("bookingAdmin.cancelBooking")}
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
  const t = useT();
  const { locale } = useLocale();
  const [, formAction] = useActionState(withToast(updateBookingStatusAction), idleState);
  const live = booking.status === "pending" || booking.status === "confirmed";
  const noShowAllowed = canMarkNoShow(booking);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{booking.service_name}</SheetTitle>
          <SheetDescription>
            {formatInBusinessTz(booking.starts_at, timezone, "EEEE d MMMM", locale)} ·{" "}
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
            <span
              className="text-xs text-fg-subtle"
              data-testid="booking-source"
              data-source={booking.source}
            >
              {t("bookingAdmin.sourceLabel")}:{" "}
              {t(booking.source === "shop" ? "bookingAdmin.sourceShop" : "bookingAdmin.sourceCustomer")}
            </span>
          </div>

          <dl className="space-y-3 rounded-xl bg-surface-muted p-3.5 text-sm">
            <div className="flex items-start gap-2.5">
              <UserRound className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
              <div className="min-w-0">
                <dt className="sr-only">{t("bookingAdmin.customer")}</dt>
                <dd className="font-semibold">{booking.customer_name}</dd>
              </div>
            </div>

            {booking.customer_phone ? (
              <div className="flex items-start gap-2.5">
                <Phone className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                <div className="min-w-0">
                  <dt className="sr-only">{t("bookingAdmin.phone")}</dt>
                  <dd>
                    <a
                      href={`tel:${booking.customer_phone.replace(/\s/g, "")}`}
                      className="font-semibold text-accent-ink hover:underline"
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
                  <dt className="sr-only">{t("bookingAdmin.notes")}</dt>
                  <dd className="text-fg-muted text-pretty">{booking.notes}</dd>
                </div>
              </div>
            ) : null}
          </dl>

          {/* Simple client records (roadmap.md §1 row 5): a note that follows
              this customer across every booking at this business, not just
              the one-off note above tied to a single booking. Never shown to
              the customer — see the RLS policy in the matching migration. */}
          {booking.customer_id ? (
            <CustomerNoteSection customerId={booking.customer_id} open={open} />
          ) : null}
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
                  {t("bookingAdmin.move")}
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
                    {t("bookingAdmin.confirm")}
                  </SubmitButton>
                </form>
              ) : null}
              {noShowAllowed ? (
                <form action={formAction} className="flex-1">
                  <input type="hidden" name="id" value={booking.id} />
                  <input type="hidden" name="status" value="no_show" />
                  <SubmitButton variant="outline" testId="booking-no-show">
                    {t("bookingAdmin.noShow")}
                  </SubmitButton>
                </form>
              ) : null}
              {booking.status === "confirmed" ? (
                <form action={formAction} className="flex-1">
                  <input type="hidden" name="id" value={booking.id} />
                  <input type="hidden" name="status" value="completed" />
                  <SubmitButton variant="primary" testId="booking-done">
                    <Check />
                    {t("bookingAdmin.done")}
                  </SubmitButton>
                </form>
              ) : null}
            </div>
          </SheetFooter>
        ) : null}

        {/* A mis-tapped no-show must be reversible, or one slip corrupts the
            beta numbers for good. Puts the booking back to confirmed. */}
        {booking.status === "no_show" ? (
          <SheetFooter>
            <form action={formAction} className="w-full">
              <input type="hidden" name="id" value={booking.id} />
              <input type="hidden" name="status" value="confirmed" />
              <SubmitButton variant="outline" testId="booking-undo-no-show">
                <Undo2 />
                {t("bookingAdmin.undoNoShow")}
              </SubmitButton>
            </form>
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
  const t = useT();
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
        {t("bookingAdmin.loadingCustomerNotes")}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="customerId" value={customerId} />
      <label htmlFor="customerNote" className="flex items-center gap-2 text-sm font-medium">
        <NotebookPen className="size-4 shrink-0 text-fg-subtle" />
        {t("bookingAdmin.customerNotes")}
      </label>
      <Textarea
        id="customerNote"
        name="note"
        defaultValue={initialNote}
        maxLength={2000}
        placeholder={t("bookingAdmin.customerNotePlaceholder")}
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
  const t = useT();
  return (
    <Button type="submit" size="sm" variant="outline" loading={pending}>
      {t("bookingAdmin.saveNote")}
    </Button>
  );
}

function SubmitButton({
  variant,
  children,
  testId,
}: {
  variant: "accent" | "primary" | "outline";
  children: React.ReactNode;
  testId?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="md" block variant={variant} loading={pending} data-testid={testId}>
      {children}
    </Button>
  );
}

function CancelButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" size="md" variant="ghost" loading={pending} className="text-danger">
      <Ban />
      {t("bookingAdmin.cancelBooking")}
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
