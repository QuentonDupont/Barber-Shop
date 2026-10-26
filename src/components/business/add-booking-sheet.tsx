"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { CalendarX2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Alert } from "@/components/ui/alert";
import {
  createShopBookingAction,
  getShopSlotsAction,
  type ShopSlot,
} from "@/lib/actions/shop-bookings";
import { idleState } from "@/lib/actions/types";
import { formatMoney } from "@/lib/booking/time";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export interface AddBookingService {
  id: string;
  name: string;
  duration_min: number;
  price: number;
  currency: string;
}

export interface AddBookingStaff {
  id: string;
  name: string;
}

const SELECT_CLASS =
  "min-h-12 w-full rounded-lg border border-border bg-surface px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

/**
 * Owner "add booking": for a customer who phones, messages on LINE or walks in
 * and has no account. Service, barber, date and time come from the same
 * availability engine the customers use (so a clash cannot be entered), plus a
 * name and a phone number. Saved as a shop-entered booking.
 */
export function AddBookingSheet({
  services,
  staff,
  today,
  className,
}: {
  services: AddBookingService[];
  staff: AddBookingStaff[];
  /** Today's date in the shop's time zone, `yyyy-MM-dd`. */
  today: string;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="accent"
          size="sm"
          className={className}
          data-testid="add-booking-button"
        >
          <Plus />
          {t("ownerAdd.button")}
        </Button>
      </SheetTrigger>
      <SheetContent data-testid="add-booking-sheet">
        <AddBookingForm
          services={services}
          staff={staff}
          today={today}
          onDone={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function AddBookingForm({
  services,
  staff,
  today,
  onDone,
}: {
  services: AddBookingService[];
  staff: AddBookingStaff[];
  today: string;
  onDone: () => void;
}) {
  const t = useT();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [staffId, setStaffId] = useState("any");
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<ShopSlot[] | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [choice, setChoice] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [state, formAction] = useActionState(createShopBookingAction, idleState);
  const errors = state.fieldErrors ?? {};
  const handled = useRef<typeof state | null>(null);

  const loadSlots = () => {
    if (!serviceId || !date) return;
    startLoading(async () => {
      const result = await getShopSlotsAction(serviceId, staffId, date);
      if (result.status === "error") {
        toast.error(result.message);
        setSlots([]);
        return;
      }
      setIsOpen(result.isOpen);
      setSlots(result.slots);
    });
  };

  useEffect(() => {
    setChoice(null);
    setSlots(null);
    if (!serviceId || !date) return;
    let cancelled = false;
    startLoading(async () => {
      const result = await getShopSlotsAction(serviceId, staffId, date);
      if (cancelled) return;
      if (result.status === "error") {
        toast.error(result.message);
        setSlots([]);
        return;
      }
      setIsOpen(result.isOpen);
      setSlots(result.slots);
    });
    return () => {
      cancelled = true;
    };
  }, [serviceId, staffId, date]);

  useEffect(() => {
    if (handled.current === state) return;
    handled.current = state;
    if (state.status === "success") {
      toast.success(state.message ?? t("ownerAdd.submit"));
      onDone();
    }
    if (state.status === "error" && state.message) {
      toast.error(state.message);
      // The time may have been taken meanwhile: show what is free now.
      setChoice(null);
      loadSlots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <>
      <SheetHeader>
        <SheetTitle>{t("ownerAdd.title")}</SheetTitle>
        <SheetDescription>{t("ownerAdd.description")}</SheetDescription>
      </SheetHeader>

      {services.length === 0 ? (
        <SheetBody>
          <Alert tone="info">{t("ownerAdd.noServices")}</Alert>
        </SheetBody>
      ) : (
        <form action={formAction} noValidate>
          <input type="hidden" name="startsAt" value={choice ?? ""} />
          <SheetBody>
            {state.status === "error" && state.message ? (
              <Alert tone="error">{state.message}</Alert>
            ) : null}

            <Field label={t("ownerAdd.service")} htmlFor="add-service">
              <select
                id="add-service"
                name="serviceId"
                data-testid="add-booking-service"
                className={SELECT_CLASS}
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {formatMoney(s.price, s.currency)}
                  </option>
                ))}
              </select>
            </Field>

            {staff.length > 0 ? (
              <Field label={t("ownerAdd.barber")} htmlFor="add-staff">
                <select
                  id="add-staff"
                  name="staffId"
                  data-testid="add-booking-staff"
                  className={SELECT_CLASS}
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                >
                  <option value="any">{t("ownerAdd.barberAny")}</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <Field label={t("ownerAdd.date")} htmlFor="add-date">
              <Input
                id="add-date"
                type="date"
                data-testid="add-booking-date"
                min={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t("ownerAdd.time")}</p>
              {loading || slots === null ? (
                <div className="flex min-h-20 items-center justify-center gap-2 rounded-xl border border-border text-sm text-fg-muted">
                  <Loader2 className="size-4 animate-spin" />
                  {t("ownerAdd.loadingTimes")}
                </div>
              ) : slots.length === 0 || !isOpen ? (
                <div
                  className="flex min-h-20 items-center justify-center gap-2 rounded-xl border border-border text-sm text-fg-muted"
                  data-testid="add-booking-no-times"
                >
                  <CalendarX2 className="size-4" />
                  {t("ownerAdd.noTimes")}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="add-booking-slots">
                  {slots.map((slot) => {
                    const active = slot.startsAt === choice;
                    return (
                      <button
                        key={slot.startsAt}
                        type="button"
                        data-testid="add-booking-slot"
                        data-starts-at={slot.startsAt}
                        onClick={() => setChoice(active ? null : slot.startsAt)}
                        aria-pressed={active}
                        className={cn(
                          "min-h-12 rounded-lg border text-sm font-semibold tabular-nums transition-colors",
                          "outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                          active
                            ? "border-accent bg-accent text-accent-fg"
                            : "border-border bg-surface hover:border-accent/50 hover:bg-accent-soft",
                        )}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {errors.startsAt ? <p className="text-sm text-danger">{t("msg.walkInIncomplete")}</p> : null}
            </div>

            <Field label={t("ownerAdd.customerName")} htmlFor="add-name" error={errors.customerName} required>
              <Input
                id="add-name"
                name="customerName"
                data-testid="add-booking-name"
                autoComplete="off"
                required
              />
            </Field>

            <Field label={t("ownerAdd.customerPhone")} htmlFor="add-phone" error={errors.customerPhone} required>
              <Input
                id="add-phone"
                name="customerPhone"
                type="tel"
                inputMode="tel"
                data-testid="add-booking-phone"
                autoComplete="off"
                required
              />
            </Field>

            <Field label={t("ownerAdd.notes")} htmlFor="add-notes">
              <Textarea id="add-notes" name="notes" maxLength={400} data-testid="add-booking-notes" />
            </Field>

          </SheetBody>

          <SheetFooter>
            <SubmitButton disabled={!choice} />
          </SheetFooter>
        </form>
      )}
    </>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button
      type="submit"
      size="lg"
      variant="accent"
      block
      loading={pending}
      disabled={disabled}
      data-testid="add-booking-submit"
    >
      {t("ownerAdd.submit")}
    </Button>
  );
}
