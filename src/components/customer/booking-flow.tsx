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
  Users,
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
import { useT, useLocale } from "@/lib/i18n/context";
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

/** A named barber the customer can choose, for the current service + date. */
export interface StaffOption {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/** Same shape as the business-wide `openDays`/`loadedDays` pair, scoped to
 * either one staff member's own calendar or the "any available" union. */
export interface StaffAvailabilityEntry {
  openDays: Record<DateKey, boolean>;
  loadedDays: DayPayload[];
}

/** The literal client posts when the customer hasn't named a specific barber. */
export const ANY_STAFF = "any" as const;

export function BookingFlow({
  business,
  services,
  selectedService,
  selectedDate,
  today,
  maxDate,
  openDays,
  loadedDays,
  staffOptions,
  staffByMember,
  viewer,
}: {
  business: BusinessRow;
  services: ServiceRow[];
  selectedService: ServiceRow | null;
  selectedDate: DateKey;
  today: DateKey;
  maxDate: DateKey;
  /** Whole horizon: which dates have at least one free slot. When staff are
   * configured for this service, this is already the "any available" union —
   * the default view before the customer names a specific barber. */
  openDays: Record<DateKey, boolean>;
  /** The window whose slots were sent down with the page. Same "any
   * available" default as `openDays` above. */
  loadedDays: DayPayload[];
  /** Named barbers bookable for the current service + date. Empty means no
   * staff step at all — a solo shop books exactly like before this feature. */
  staffOptions: StaffOption[];
  /** Per-staff override for `openDays`/`loadedDays`, keyed by staff id —
   * applied instead of the "any available" union once a name is chosen. */
  staffByMember: Record<string, StaffAvailabilityEntry>;
  viewer: Viewer;
}) {
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();
  const [pending, startTransition] = useTransition();
  const [slotIso, setSlotIso] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(ANY_STAFF);

  const hasStaffStep = staffOptions.length > 0;

  // The named-staff list is date/service dependent (rostering, narrowed
  // services) — if the previous pick drops out, fall back to "any available"
  // rather than silently keeping a stale, no-longer-offered selection.
  useEffect(() => {
    if (
      selectedStaffId !== ANY_STAFF &&
      !staffOptions.some((option) => option.id === selectedStaffId)
    ) {
      setSelectedStaffId(ANY_STAFF);
    }
  }, [staffOptions, selectedStaffId]);

  const staffOverride = hasStaffStep && selectedStaffId !== ANY_STAFF ? staffByMember[selectedStaffId] : null;
  const effectiveOpenDays = staffOverride?.openDays ?? openDays;
  const effectiveLoadedDays = staffOverride?.loadedDays ?? loadedDays;

  const loaded = effectiveLoadedDays.find((day) => day.date === selectedDate);
  const slots = loaded?.slots ?? null;

  const dateStepNumber = hasStaffStep ? 3 : 2;
  const timeStepNumber = hasStaffStep ? 4 : 3;

  const navigate = (next: { service?: string; date?: DateKey }) => {
    const params = new URLSearchParams();
    params.set("service", next.service ?? selectedService?.id ?? "");
    params.set("date", next.date ?? selectedDate);
    setSlotIso(null);
    startTransition(() => {
      router.replace(businessPath(business.slug, Object.fromEntries(params)), { scroll: false });
    });
  };

  const selectStaff = (id: string) => {
    setSlotIso(null);
    setSelectedStaffId(id);
  };

  if (services.length === 0) {
    return (
      <EmptyState
        icon={CalendarX2}
        title={t("booking.nothingToBookTitle")}
        description={t("booking.nothingToBookDescription", { name: business.name })}
      />
    );
  }

  return (
    <div className="space-y-7 pb-28 md:pb-8">
      {/* ---- 1. Service ---------------------------------------------------- */}
      <section aria-labelledby="pick-service" className="space-y-2.5">
        <StepHeading number={1} id="pick-service">
          {t("booking.stepService")}
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

      {/* ---- 2. Staff (only when this business has bookable staff) --------- */}
      {hasStaffStep ? (
        <section aria-labelledby="pick-staff" className="space-y-2.5">
          <StepHeading number={2} id="pick-staff">
            {t("booking.stepStaff")}
          </StepHeading>

          <div className="space-y-2">
            <StaffChoiceButton
              active={selectedStaffId === ANY_STAFF}
              onClick={() => selectStaff(ANY_STAFF)}
              name={t("booking.anyAvailable")}
              hint={t("booking.anyAvailableHint")}
              anyAvailable
            />
            {staffOptions.map((option) => (
              <StaffChoiceButton
                key={option.id}
                active={selectedStaffId === option.id}
                onClick={() => selectStaff(option.id)}
                name={option.name}
                avatarUrl={option.avatarUrl}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* ---- 3. Date ------------------------------------------------------- */}
      <section aria-labelledby="pick-date" className="space-y-3">
        <StepHeading number={dateStepNumber} id="pick-date">
          {t("booking.stepDate")}
        </StepHeading>

        <div className="rounded-xl border border-border bg-surface p-3.5">
          <Calendar
            selected={selectedDate}
            onSelect={(date) => navigate({ date })}
            enabledDays={effectiveOpenDays}
            minDate={today}
            maxDate={maxDate}
            today={today}
          />
        </div>
      </section>

      {/* ---- 4. Time ------------------------------------------------------- */}
      <section aria-labelledby="pick-time" className="space-y-3">
        <StepHeading number={timeStepNumber} id="pick-time">
          {t("booking.stepTime")}
        </StepHeading>

        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <CalendarDays className="size-4 shrink-0" />
          {formatInBusinessTz(`${selectedDate}T12:00:00Z`, "UTC", "EEEE d MMMM", locale)}
          <span className="text-fg-subtle">· {business.timezone}</span>
        </p>

        {pending ? (
          <div className="flex min-h-24 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-sm text-fg-muted">
            <Loader2 className="size-4 animate-spin" />
            {t("booking.checkingAvailability")}
          </div>
        ) : slots === null ? (
          <div className="flex min-h-24 items-center justify-center rounded-xl border border-border bg-surface text-sm text-fg-muted">
            {t("booking.loadingTimes")}
          </div>
        ) : slots.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title={t("booking.noFreeTimesTitle")}
            description={t("booking.noFreeTimesDescription")}
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
                {formatInBusinessTz(`${selectedDate}T12:00:00Z`, "UTC", "EEE d MMM", locale)} ·{" "}
                {formatInBusinessTz(slotIso, business.timezone, "h:mm a", locale)} ·{" "}
                {formatMoney(selectedService.price, selectedService.currency)}
              </p>
            </div>
            {viewer === "customer" ? (
              <Button size="lg" variant="accent" onClick={() => setConfirming(true)}>
                {t("booking.review")}
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
                  {t("booking.signInToBook")}
                  <ChevronRight />
                </Link>
              </Button>
            ) : (
              <span className="shrink-0 rounded-lg bg-surface-muted px-3 py-2 text-xs font-semibold text-fg-muted">
                {t("booking.previewOnly")}
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
          staffId={hasStaffStep ? selectedStaffId : null}
          staffName={
            hasStaffStep && selectedStaffId !== ANY_STAFF
              ? staffOptions.find((option) => option.id === selectedStaffId)?.name ?? null
              : null
          }
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
  staffId,
  staffName,
  onBooked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  business: BusinessRow;
  service: ServiceRow;
  startsAt: string;
  /** `null` when this business has no staff step at all; otherwise a staff
   * uuid or `"any"`, exactly what `createBookingAction` expects. */
  staffId: string | null;
  /** Display name for the row below, or `null` for "any available". */
  staffName: string | null;
  onBooked: () => void;
}) {
  const [state, formAction] = useActionState(createBookingAction, idleState);
  const t = useT();
  const { locale } = useLocale();

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? t("confirm.bookedFallback"));
      onBooked();
    }
    if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state, onBooked, t]);

  const endsAt = new Date(
    new Date(startsAt).getTime() + (service.duration_min + service.buffer_min) * 60_000,
  ).toISOString();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("confirm.title")}</SheetTitle>
          <SheetDescription>
            {business.auto_confirm
              ? t("confirm.descriptionAuto")
              : t("confirm.descriptionManual", { name: business.name })}
          </SheetDescription>
        </SheetHeader>

        <form action={formAction}>
          <SheetBody>
            <input type="hidden" name="businessId" value={business.id} />
            <input type="hidden" name="serviceId" value={service.id} />
            <input type="hidden" name="startsAt" value={startsAt} />
            {staffId ? <input type="hidden" name="staffId" value={staffId} /> : null}

            <dl className="divide-y divide-border rounded-xl bg-surface-muted px-3.5">
              <Row label={t("confirm.rowWhere")} value={business.name} sub={business.address} />
              <Row
                label={t("confirm.rowWhat")}
                value={service.name}
                sub={formatDuration(service.duration_min)}
              />
              {staffId ? (
                <Row
                  label={t("confirm.rowStaff")}
                  value={staffName ?? t("booking.anyAvailable")}
                />
              ) : null}
              <Row
                label={t("confirm.rowWhen")}
                value={formatInBusinessTz(startsAt, business.timezone, "EEEE d MMMM", locale)}
                sub={`${formatInBusinessTz(startsAt, business.timezone, "h:mm a", locale)} – ${formatInBusinessTz(
                  endsAt,
                  business.timezone,
                  "h:mm a",
                  locale,
                )} (${business.timezone})`}
              />
              <Row
                label={t("confirm.rowPrice")}
                value={formatMoney(service.price, service.currency)}
                sub={t("confirm.paidAtShop")}
              />
            </dl>

            {/* Cancellation/no-show policy — shown here, on the listing page, and in
                the confirmation email (roadmap.md §1 row 6; ux-benchmark.md §4.2's
                "repeat it everywhere" pattern). */}
            <div className="rounded-xl border border-border bg-surface p-3.5">
              <p className="text-sm font-semibold">{t("confirm.cancellationPolicyLabel")}</p>
              <p className="mt-1 text-sm text-fg-muted text-pretty">
                {business.cancellation_policy || t("confirm.cancellationPolicyFallback")}
              </p>
            </div>

            <Field
              label={t("confirm.notesLabel")}
              htmlFor="notes"
              hint={t("confirm.notesHint")}
            >
              <Textarea
                id="notes"
                name="notes"
                maxLength={400}
                placeholder={t("confirm.notesPlaceholder")}
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

function StaffChoiceButton({
  active,
  onClick,
  name,
  hint,
  avatarUrl,
  anyAvailable = false,
}: {
  active: boolean;
  onClick: () => void;
  name: string;
  hint?: string;
  avatarUrl?: string | null;
  /** The "any available" option gets a people icon, not an initial letter —
   * it isn't a single person's name. */
  anyAvailable?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        active
          ? "border-accent bg-accent-soft/60"
          : "border-border bg-surface hover:bg-surface-muted",
      )}
    >
      {avatarUrl ? (
        // avatar_url is owner-provided and may be any host; next/image would
        // require per-domain config this lean build doesn't carry.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          aria-hidden
          className="size-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent"
          aria-hidden
        >
          {anyAvailable ? <Users className="size-4" /> : name.trim().charAt(0).toUpperCase()}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{name}</span>
        {hint ? <span className="mt-0.5 block text-sm text-fg-muted text-pretty">{hint}</span> : null}
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
  const t = useT();
  return (
    <Button type="submit" size="lg" block variant="accent" loading={pending}>
      {autoConfirm ? t("confirm.confirmButton") : t("confirm.sendRequestButton")}
    </Button>
  );
}
