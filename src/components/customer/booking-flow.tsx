"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  CalendarX2,
  Check,
  ChevronRight,
  Loader2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
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
  formatSlotTime,
  type DateKey,
} from "@/lib/booking/time";
import { businessPath } from "@/lib/routes";
import { useT, useLocale } from "@/lib/i18n/context";
import { cn, initials } from "@/lib/utils";

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
    <div className="pb-28 md:pb-8">
      <ol className="list-none space-y-8">
      {/* ---- 1. Service ---------------------------------------------------- */}
      <li>
      <section aria-labelledby="pick-service" className="space-y-3">
        <StepHeading done={selectedService != null} id="pick-service">
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
                  "appt-press flex w-full items-center gap-3 rounded-[var(--radius-field)] border p-4 text-left",
                  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "border-accent bg-accent-soft"
                    : "border-border bg-surface hover:border-border-strong",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{service.name}</span>
                  {service.description ? (
                    <span className="mt-0.5 block text-sm text-fg-muted text-pretty">
                      {service.description}
                    </span>
                  ) : null}
                  <span className="num mt-1 block text-sm text-fg-muted">
                    {formatDuration(service.duration_min)} ·{" "}
                    <span className="font-semibold text-fg">
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
      </li>

      {/* ---- 2. Staff (only when this business has bookable staff) --------- */}
      {hasStaffStep ? (
        <li>
        <section aria-labelledby="pick-staff" className="space-y-3">
          <StepHeading done id="pick-staff">
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
        </li>
      ) : null}

      {/* ---- 3. Date ------------------------------------------------------- */}
      <li>
      <section aria-labelledby="pick-date" className="space-y-3">
        <StepHeading done={effectiveOpenDays[selectedDate] === true} id="pick-date">
          {t("booking.stepDate")}
        </StepHeading>

        <div className="rounded-[var(--radius-panel)] border border-border bg-surface p-3 sm:p-5">
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
      </li>

      {/* ---- 4. Time ------------------------------------------------------- */}
      <li>
      <section aria-labelledby="pick-time" className="space-y-3">
        <StepHeading done={slotIso != null} id="pick-time">
          {t("booking.stepTime")}
        </StepHeading>

        <p className="text-sm text-fg-muted">
          {formatInBusinessTz(`${selectedDate}T12:00:00Z`, "UTC", "EEEE d MMMM", locale)}
          {" · "}
          {business.timezone}
        </p>

        {pending ? (
          <div className="flex min-h-24 items-center justify-center gap-2 rounded-[var(--radius-panel)] border border-border bg-surface text-sm text-fg-muted">
            <Loader2 className="size-4 animate-spin" />
            {t("booking.checkingAvailability")}
          </div>
        ) : slots === null ? (
          <div className="flex min-h-24 items-center justify-center rounded-[var(--radius-panel)] border border-border bg-surface text-sm text-fg-muted">
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
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            {slots.map((slot) => {
              const active = slot.startsAt === slotIso;
              return (
                <button
                  key={slot.startsAt}
                  type="button"
                  onClick={() => setSlotIso(active ? null : slot.startsAt)}
                  aria-pressed={active}
                  className={cn(
                    "appt-press num min-h-12 rounded-full border text-[15px] font-semibold",
                    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    active
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-border-strong bg-surface text-fg hover:border-fg/30",
                  )}
                >
                  {formatSlotTime(slot.startsAt, business.timezone, locale)}
                </button>
              );
            })}
          </div>
        )}
      </section>
      </li>
      </ol>

      {/* ---- Sticky confirm bar -------------------------------------------
          Fixed above the tab bar so the action is always one thumb-tap away,
          however far down the slot grid the user has scrolled. -------------- */}
      {selectedService && slotIso ? (
        <div className="fixed inset-x-0 bottom-0 z-30 mt-6 border-t border-border bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:sticky md:bottom-4 md:rounded-[var(--radius-panel)] md:border-0 md:px-4 md:pb-3 md:shadow-[var(--shadow-float)]">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{selectedService.name}</p>
              <p className="num truncate text-[13px] text-fg-muted">
                {formatInBusinessTz(`${selectedDate}T12:00:00Z`, "UTC", "EEE d MMM", locale)} ·{" "}
                {formatSlotTime(slotIso, business.timezone, locale)} ·{" "}
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
              <span className="shrink-0 rounded-full bg-surface-muted px-3 py-2 text-[13px] font-semibold text-fg-muted">
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

/** A state marker, not a number: an empty ring until the step has a value,
 * then a brass check. */
function StepHeading({
  done,
  id,
  children,
}: {
  done: boolean;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2 id={id} className="flex items-center gap-2.5 text-lg font-semibold">
      <span
        aria-hidden
        className={cn(
          "flex size-[22px] shrink-0 items-center justify-center rounded-full transition-colors duration-150",
          done ? "bg-accent text-accent-fg" : "border-2 border-border-strong",
        )}
      >
        {done ? <Check className="size-3.5" strokeWidth={3} /> : null}
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
  const router = useRouter();

  // Each action result is handled once: the parent re-renders when the sheet
  // closes, which hands this effect a fresh onBooked and would repeat the toast.
  const handledState = useRef<typeof state | null>(null);

  useEffect(() => {
    if (handledState.current === state) return;
    handledState.current = state;
    if (state.status === "success") {
      toast.success(state.message ?? t("confirm.bookedFallback"));
      onBooked();
    }
    if (state.status === "error" && state.message) {
      // PDPA consent gate (QA report #7 §5): give a direct way to act on
      // the blocked state, not just a prose pointer to the account page.
      toast.error(
        state.message,
        state.consentBlocked
          ? {
              action: {
                label: t("privacy.goToAccountAction"),
                onClick: () => router.push("/app/account"),
              },
            }
          : undefined,
      );
      // QA 11 BUG 3: close the sheet so the "Go to account" action is tappable.
      if (state.consentBlocked) onOpenChange(false);
    }
  }, [state, onBooked, onOpenChange, t, router]);

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

            <dl className="divide-y divide-border rounded-[var(--radius-panel)] bg-surface-muted px-4">
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
                sub={`${formatSlotTime(startsAt, business.timezone, locale)} – ${formatSlotTime(
                  endsAt,
                  business.timezone,
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
            <div className="rounded-[var(--radius-panel)] border border-border bg-surface p-4">
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
        "appt-press flex w-full items-center gap-3 rounded-[var(--radius-field)] border p-4 text-left",
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active
          ? "border-accent bg-accent-soft"
          : "border-border bg-surface hover:border-border-strong",
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
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-fg"
          aria-hidden
        >
          {anyAvailable ? <Users className="size-4" /> : initials(name)}
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
      <dd className="min-w-0 text-right text-[15px]">
        <span className="block font-semibold">{value}</span>
        {sub ? <span className="num block text-sm text-fg-muted text-pretty">{sub}</span> : null}
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
