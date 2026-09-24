"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  CalendarDays,
  CalendarX2,
  Check,
  ChevronRight,
  Clock3,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
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
import { createBookingAction } from "@/lib/actions/bookings";
import { idleState } from "@/lib/actions/types";
import type { BusinessRow, ServiceRow } from "@/lib/database.types";
import type { Slot } from "@/lib/booking/slots";
import {
  formatDuration,
  formatInBusinessTz,
  formatMoney,
  type DateKey,
} from "@/lib/booking/time";
import { businessPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * Who is looking at the page decides what the final button does:
 * a customer books, a signed-out visitor is sent to sign in and comes straight
 * back to the same service and day, and an owner gets a read-only preview.
 */
export type Viewer = "customer" | "anon" | "owner" | "other-business";

export interface DayPayload {
  date: DateKey;
  slots: Slot[] | null;
}

export function BookingFlow({
  business,
  services,
  selectedService,
  selectedDate,
  today,
  maxDate,
  openDays,
  loadedDays,
  viewer,
}: {
  business: BusinessRow;
  services: ServiceRow[];
  selectedService: ServiceRow | null;
  selectedDate: DateKey;
  today: DateKey;
  maxDate: DateKey;
  /** Whole horizon: which dates have at least one free slot. */
  openDays: Record<DateKey, boolean>;
  /** The window whose slots were sent down with the page. */
  loadedDays: DayPayload[];
  viewer: Viewer;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [slotIso, setSlotIso] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const loaded = loadedDays.find((day) => day.date === selectedDate);
  const slots = loaded?.slots ?? null;

  const navigate = (next: { service?: string; date?: DateKey }) => {
    const params = new URLSearchParams();
    params.set("service", next.service ?? selectedService?.id ?? "");
    params.set("date", next.date ?? selectedDate);
    setSlotIso(null);
    startTransition(() => {
      router.replace(businessPath(business.slug, Object.fromEntries(params)), { scroll: false });
    });
  };

  if (services.length === 0) {
    return (
      <EmptyState
        icon={CalendarX2}
        title="Nothing to book just yet"
        description={`${business.name} has not published any services. Try again soon, or give them a call.`}
      />
    );
  }

  return (
    <div className="space-y-7 pb-28 md:pb-8">
      {/* ---- 1. Service ---------------------------------------------------- */}
      <section aria-labelledby="pick-service" className="space-y-2.5">
        <StepHeading number={1} id="pick-service">
          Choose a service
        </StepHeading>

        <div className="space-y-2">
          {services.map((service) => {
            const active = service.id === selectedService?.id;
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => navigate({ service: service.id })}
                aria-pressed={active}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
                  "outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                  active
                    ? "border-accent bg-accent-soft/60"
                    : "border-border bg-surface hover:bg-surface-muted",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{service.name}</span>
                  {service.description ? (
                    <span className="mt-0.5 block text-sm text-fg-muted text-pretty">
                      {service.description}
                    </span>
                  ) : null}
                  <span className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">
                      <Clock3 />
                      {formatDuration(service.duration_min)}
                    </Badge>
                    <span className="text-sm font-semibold">
                      {formatMoney(service.price, service.currency)}
                    </span>
                  </span>
                </span>

                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                    active ? "border-accent bg-accent text-accent-fg" : "border-border-strong",
                  )}
                  aria-hidden
                >
                  {active ? <Check className="size-3.5" strokeWidth={3} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---- 2. Date ------------------------------------------------------- */}
      <section aria-labelledby="pick-date" className="space-y-3">
        <StepHeading number={2} id="pick-date">
          Pick a day
        </StepHeading>

        <div className="rounded-xl border border-border bg-surface p-3.5">
          <Calendar
            selected={selectedDate}
            onSelect={(date) => navigate({ date })}
            enabledDays={openDays}
            minDate={today}
            maxDate={maxDate}
            today={today}
          />
        </div>
      </section>

      {/* ---- 3. Time ------------------------------------------------------- */}
      <section aria-labelledby="pick-time" className="space-y-3">
        <StepHeading number={3} id="pick-time">
          Pick a time
        </StepHeading>

        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <CalendarDays className="size-4 shrink-0" />
          {formatInBusinessTz(`${selectedDate}T12:00:00Z`, "UTC", "EEEE d MMMM")}
          <span className="text-fg-subtle">· {business.timezone}</span>
        </p>

        {pending ? (
          <div className="flex min-h-24 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-sm text-fg-muted">
            <Loader2 className="size-4 animate-spin" />
            Checking availability…
          </div>
        ) : slots === null ? (
          <div className="flex min-h-24 items-center justify-center rounded-xl border border-border bg-surface text-sm text-fg-muted">
            Loading times…
          </div>
        ) : slots.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title="No free times that day"
            description="They are closed or fully booked. Try another date on the calendar above."
          />
        ) : (
          // 3 columns on the narrowest phone keeps each chip comfortably over
          // 44px wide; more columns appear as the screen allows.
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {slots.map((slot) => {
              const active = slot.startsAt === slotIso;
              return (
                <button
                  key={slot.startsAt}
                  type="button"
                  onClick={() => setSlotIso(active ? null : slot.startsAt)}
                  aria-pressed={active}
                  className={cn(
                    "min-h-12 rounded-lg border text-sm font-semibold tabular-nums transition-colors",
                    "outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                    active
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-border bg-surface text-fg hover:border-accent/50 hover:bg-accent-soft",
                  )}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ---- Sticky confirm bar -------------------------------------------
          Fixed above the tab bar so the action is always one thumb-tap away,
          however far down the slot grid the user has scrolled. -------------- */}
      {selectedService && slotIso ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-lg md:sticky md:bottom-4 md:rounded-xl md:border md:pb-3 md:shadow-[var(--shadow-raised)]">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{selectedService.name}</p>
              <p className="truncate text-xs text-fg-muted">
                {formatInBusinessTz(`${selectedDate}T12:00:00Z`, "UTC", "EEE d MMM")} ·{" "}
                {formatInBusinessTz(slotIso, business.timezone, "h:mm a")} ·{" "}
                {formatMoney(selectedService.price, selectedService.currency)}
              </p>
            </div>
            {viewer === "customer" ? (
              <Button size="lg" variant="accent" onClick={() => setConfirming(true)}>
                Review
                <ChevronRight />
              </Button>
            ) : viewer === "anon" ? (
              <Button asChild size="lg" variant="accent">
                <Link
                  href={`/sign-in?role=customer&next=${encodeURIComponent(
                    businessPath(business.slug, {
                      service: selectedService.id,
                      date: selectedDate,
                    }),
                  )}`}
                >
                  Sign in to book
                  <ChevronRight />
                </Link>
              </Button>
            ) : (
              <span className="shrink-0 rounded-lg bg-surface-muted px-3 py-2 text-xs font-semibold text-fg-muted">
                Preview only
              </span>
            )}
          </div>
        </div>
      ) : null}

      {selectedService && slotIso && viewer === "customer" ? (
        <ConfirmSheet
          open={confirming}
          onOpenChange={setConfirming}
          business={business}
          service={selectedService}
          startsAt={slotIso}
          onBooked={() => {
            setConfirming(false);
            setSlotIso(null);
            router.push("/app/bookings");
          }}
        />
      ) : null}
    </div>
  );
}

function StepHeading({
  number,
  id,
  children,
}: {
  number: number;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2 id={id} className="flex items-center gap-2.5 text-base font-bold tracking-tight">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg">
        {number}
      </span>
      {children}
    </h2>
  );
}

function ConfirmSheet({
  open,
  onOpenChange,
  business,
  service,
  startsAt,
  onBooked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  business: BusinessRow;
  service: ServiceRow;
  startsAt: string;
  onBooked: () => void;
}) {
  const [state, formAction] = useActionState(createBookingAction, idleState);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Booked.");
      onBooked();
    }
    if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state, onBooked]);

  const endsAt = new Date(
    new Date(startsAt).getTime() + (service.duration_min + service.buffer_min) * 60_000,
  ).toISOString();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Confirm your booking</SheetTitle>
          <SheetDescription>
            {business.auto_confirm
              ? "Your slot is held as soon as you confirm."
              : `${business.name} will review and confirm this request. Your slot is held in the meantime.`}
          </SheetDescription>
        </SheetHeader>

        <form action={formAction}>
          <SheetBody>
            <input type="hidden" name="businessId" value={business.id} />
            <input type="hidden" name="serviceId" value={service.id} />
            <input type="hidden" name="startsAt" value={startsAt} />

            <dl className="divide-y divide-border rounded-xl bg-surface-muted px-3.5">
              <Row label="Where" value={business.name} sub={business.address} />
              <Row
                label="What"
                value={service.name}
                sub={formatDuration(service.duration_min)}
              />
              <Row
                label="When"
                value={formatInBusinessTz(startsAt, business.timezone, "EEEE d MMMM")}
                sub={`${formatInBusinessTz(startsAt, business.timezone, "h:mm a")} – ${formatInBusinessTz(
                  endsAt,
                  business.timezone,
                  "h:mm a",
                )} (${business.timezone})`}
              />
              <Row
                label="Price"
                value={formatMoney(service.price, service.currency)}
                sub="Paid at the shop"
              />
            </dl>

            <Field
              label="Anything they should know?"
              htmlFor="notes"
              hint="Optional — allergies, a preferred stylist, running late."
            >
              <Textarea
                id="notes"
                name="notes"
                maxLength={400}
                placeholder="First time here, happy to take advice."
              />
            </Field>
          </SheetBody>

          <SheetFooter>
            <ConfirmButton autoConfirm={business.auto_confirm} />
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Row({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="shrink-0 text-sm text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-right">
        <span className="block font-semibold">{value}</span>
        {sub ? <span className="block text-sm text-fg-subtle text-pretty">{sub}</span> : null}
      </dd>
    </div>
  );
}

function ConfirmButton({ autoConfirm }: { autoConfirm: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block variant="accent" loading={pending}>
      {autoConfirm ? "Confirm booking" : "Send request"}
    </Button>
  );
}
