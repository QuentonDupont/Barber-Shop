import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, MessageCircle, Phone } from "lucide-react";
import { PageContainer } from "@/components/shared/app-shell";
import {
  BookingFlow,
  type DayPayload,
  type StaffAvailabilityEntry,
  type StaffOption,
  type Viewer,
} from "@/components/customer/booking-flow";
import { BusinessTabs } from "@/components/customer/business-tabs";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ShopMark } from "@/components/shared/shop-mark";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  availabilityForRange,
  bookableStaffFor,
  loadAvailabilitySources,
  loadStaffWithServices,
  staffCanPerform,
  staffWorksWeekday,
} from "@/lib/booking/availability";
import type { Slot } from "@/lib/booking/slots";
import { businessToday, shiftDateKey, type DateKey } from "@/lib/booking/time";
import { categoryLabel, t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

/** Union of two staff members' slot lists for one day — "any available" is
 * open at a time if at least one eligible barber is free then. */
function mergeSlots(a: Slot[], b: Slot[]): Slot[] {
  const byStart = new Map<string, Slot>();
  for (const slot of a) byStart.set(slot.startsAt, slot);
  for (const slot of b) byStart.set(slot.startsAt, slot);
  return Array.from(byStart.values()).sort((x, y) => x.startMinute - y.startMinute);
}

/**
 * How many days of full slot data travel with the page.
 *
 * Everything in this window is instant to browse; picking a date beyond it
 * costs one round trip. Sending the whole horizon instead would be a couple of
 * hundred kilobytes of JSON on a phone, for dates almost nobody opens.
 */
const PREFETCH_DAYS = 14;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("name, description")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return { title: "Not found" };
  return {
    title: data.name,
    description: data.description ?? `Book an appointment at ${data.name} on TatNat.`,
  };
}

export default async function BusinessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ service?: string; date?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const session = await getSession().catch(() => null);
  const locale = await getLocale();

  const supabase = await createClient();

  // No `is_published` filter: RLS already returns published businesses to
  // everyone and an unpublished one only to its owner, which is exactly the
  // preview-before-launch behaviour wanted here.
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!business) notFound();

  const viewer: Viewer = !session
    ? "anon"
    : session.userId === business.owner_id
      ? "owner"
      : session.profile.role === "business_owner"
        ? "other-business"
        : "customer";

  const [{ data: services }, { data: products }, { data: campaigns }, { data: mySubs }] =
    await Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("business_id", business.id)
        .eq("is_active", true)
        // Same order as the owner's Services list, so what they arrange is
        // exactly what customers see.
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("products")
        .select("*")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("campaigns")
        .select("*")
        .eq("business_id", business.id)
        .eq("is_published", true)
        .order("starts_at", { ascending: true }),
      // Only a signed-in customer has subscriptions worth looking up.
      viewer === "customer" && session
        ? supabase
            .from("campaign_subscriptions")
            .select("campaign_id, status")
            .eq("business_id", business.id)
            .eq("customer_id", session.userId)
        : Promise.resolve({ data: [] as { campaign_id: string; status: string }[] }),
    ]);

  const subscribedIds = (mySubs ?? [])
    .filter((sub) => sub.status === "going")
    .map((sub) => sub.campaign_id);

  const serviceList = services ?? [];
  const selectedService =
    serviceList.find((service) => service.id === query.service) ?? serviceList[0] ?? null;

  const today = businessToday(business.timezone);
  const horizonDays = Math.min(business.max_advance_days, 120);
  const maxDate = shiftDateKey(today, horizonDays);

  const requested =
    query.date && DATE_PATTERN.test(query.date) && query.date >= today && query.date <= maxDate
      ? query.date
      : today;

  let openDays: Record<DateKey, boolean> = {};
  let loadedDays: DayPayload[] = [];
  let staffOptions: StaffOption[] = [];
  const staffByMember: Record<string, StaffAvailabilityEntry> = {};

  if (selectedService) {
    const windowStart = requested;
    const windowEnd = shiftDateKey(windowStart, PREFETCH_DAYS - 1);

    // Multi-staff (roadmap.md §1 row 4). `allStaff` (zero rows) is the only
    // gate for the pre-multi-staff fallback below — matches
    // `createBookingAction`'s own gate, so the client's "is there a staff
    // step" decision never disagrees with what the server will actually do.
    // `eligibleStaff` (active + narrowed to services that include this one,
    // or narrowed to none) may still be empty with staff configured — that's
    // a real "nobody can take this service" state, not a business-wide one.
    const allStaff = await loadStaffWithServices(supabase, business.id);

    if (allStaff.length === 0) {
      // No staff configured for this business at all: book exactly as before
      // this feature existed — one business-wide calendar, no staff step.
      const sources = await loadAvailabilitySources(supabase, business, today, maxDate);

      const horizon = availabilityForRange(
        business,
        selectedService,
        sources,
        today,
        horizonDays + 1,
      );

      openDays = Object.fromEntries(
        horizon.map((day) => [day.date, day.slots.length > 0]),
      );
      loadedDays = horizon
        .filter((day) => day.date >= windowStart && day.date <= windowEnd)
        .map((day) => ({ date: day.date, slots: day.slots }));
    } else {
      // Staff exist for this business: every booking now resolves through a
      // staff member server-side (`createBookingAction`'s `allStaff.length
      // === 0` branch no longer applies), so compute per-staff availability
      // and an "any available" union — even if `eligibleStaff` below turns
      // out empty, in which case every day is correctly closed rather than
      // falling back to a business-wide view the server would then reject.
      const eligibleStaff = allStaff.filter(
        (staff) => staff.is_active && staffCanPerform(staff, selectedService.id),
      );

      // Pre-seed every date in the horizon/window so a day with zero
      // eligible staff still arrives as "closed with no slots", not
      // "never loaded" (which would leave the Time step spinning forever).
      const anyOpenDays: Record<DateKey, boolean> = {};
      const anyLoadedByDate = new Map<DateKey, Slot[]>();
      for (let i = 0; i <= horizonDays; i += 1) {
        const date = shiftDateKey(today, i);
        anyOpenDays[date] = false;
        if (date >= windowStart && date <= windowEnd) {
          anyLoadedByDate.set(date, []);
        }
      }

      for (const staff of eligibleStaff) {
        const sources = await loadAvailabilitySources(supabase, business, today, maxDate, {
          staffId: staff.id,
        });

        const horizon = availabilityForRange(
          business,
          selectedService,
          sources,
          today,
          horizonDays + 1,
        );

        const staffOpenDays: Record<DateKey, boolean> = {};
        const staffLoadedDays: DayPayload[] = [];

        for (const day of horizon) {
          // The availability engine only knows the business's own hours —
          // close out any day this staff member isn't rostered to work,
          // regardless of what it computed.
          const worksThatDay = staffWorksWeekday(staff, day.date);
          const slots = worksThatDay ? day.slots : [];
          const isOpen = slots.length > 0;

          staffOpenDays[day.date] = isOpen;
          anyOpenDays[day.date] = (anyOpenDays[day.date] ?? false) || isOpen;

          if (day.date >= windowStart && day.date <= windowEnd) {
            staffLoadedDays.push({ date: day.date, slots });
            anyLoadedByDate.set(day.date, mergeSlots(anyLoadedByDate.get(day.date) ?? [], slots));
          }
        }

        staffByMember[staff.id] = { openDays: staffOpenDays, loadedDays: staffLoadedDays };
      }

      // Default (no staff chosen yet) is "any available".
      openDays = anyOpenDays;
      loadedDays = Array.from(anyLoadedByDate.entries()).map(([date, slots]) => ({
        date,
        slots,
      }));

      staffOptions = bookableStaffFor(allStaff, selectedService.id, requested).map((staff) => ({
        id: staff.id,
        name: staff.name,
        avatarUrl: staff.avatar_url,
      }));
    }
  }

  return (
    <PageContainer className="max-w-3xl">
      <Link
        href={viewer === "owner" ? "/dashboard/services" : viewer === "other-business" ? "/dashboard" : "/app"}
        className="mb-3 inline-flex min-h-11 items-center gap-1.5 -ml-2 px-2 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        {viewer === "owner"
          ? t(locale, "listing.backToServices")
          : viewer === "other-business"
            ? t(locale, "listing.backToDashboard")
            : t(locale, "listing.backAllPlaces")}
      </Link>

      {viewer === "owner" ? (
        <Alert
          tone={business.is_published ? "info" : "warning"}
          title={
            business.is_published
              ? t(locale, "listing.ownerPreviewLiveTitle")
              : t(locale, "listing.ownerPreviewDraftTitle")
          }
          className="mb-5"
        >
          {business.is_published
            ? t(locale, "listing.ownerPreviewLiveBody")
            : t(locale, "listing.ownerPreviewDraftBody")}
        </Alert>
      ) : null}

      <header className="mb-6">
        <div className="flex items-start gap-3.5">
          <ShopMark
            name={business.name}
            category={business.category}
            coverUrl={business.cover_url}
            size={72}
          />
          <div className="min-w-0 flex-1">
            <h1 className="display text-[28px] sm:text-[32px]">{business.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <span className="text-sm text-fg-muted">{categoryLabel(business.category, locale)}</span>
              {business.auto_confirm ? (
                <Badge tone="success">{t(locale, "listing.instantConfirmation")}</Badge>
              ) : (
                <Badge tone="warning">{t(locale, "listing.confirmedByShop")}</Badge>
              )}
            </div>
          </div>
        </div>

        {business.description ? (
          <p className="mt-3.5 text-sm leading-relaxed text-fg-muted text-pretty">
            {business.description}
          </p>
        ) : null}

        {/* Contact actions are real links so a phone dials and LINE opens. */}
        <div className="mt-4 flex flex-wrap gap-2">
          {business.address ? (
            <a
              href={
                business.lat != null && business.lng != null
                  ? `https://www.google.com/maps/search/?api=1&query=${business.lat},${business.lng}${
                      business.place_id ? `&query_place_id=${business.place_id}` : ""
                    }`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`
              }
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 min-w-0 max-w-full flex-1 items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-muted sm:flex-none"
            >
              <MapPin className="size-4 shrink-0 text-fg-muted" />
              <span className="truncate">{business.address}</span>
            </a>
          ) : null}

          {business.phone ? (
            <a
              href={`tel:${business.phone.replace(/\s/g, "")}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-muted"
            >
              <Phone className="size-4 shrink-0 text-fg-muted" />
              {t(locale, "listing.call")}
            </a>
          ) : null}

          {business.line_id ? (
            <a
              href={`https://line.me/R/ti/p/${encodeURIComponent(business.line_id)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-muted"
            >
              <MessageCircle className="size-4 shrink-0 text-fg-muted" />
              {t(locale, "listing.line")}
            </a>
          ) : null}
        </div>

        {/* Cancellation/no-show policy — repeated here, on the booking-confirmation
            screen and in the confirmation email (roadmap.md §1 row 6). */}
        <div className="mt-4 rounded-[20px] bg-surface-muted p-4">
          <p className="text-sm font-semibold">{t(locale, "listing.cancellationPolicyHeading")}</p>
          <p className="mt-1 text-sm text-fg-muted text-pretty">
            {business.cancellation_policy || t(locale, "listing.cancellationPolicyFallback")}
          </p>
        </div>
      </header>

      <BusinessTabs
        booking={
          <BookingFlow
            business={business}
            services={serviceList}
            selectedService={selectedService}
            selectedDate={requested}
            today={today}
            maxDate={maxDate}
            openDays={openDays}
            loadedDays={loadedDays}
            staffOptions={staffOptions}
            staffByMember={staffByMember}
            viewer={viewer}
          />
        }
        products={products ?? []}
        campaigns={campaigns ?? []}
        timezone={business.timezone}
        subscribedIds={subscribedIds}
      />
    </PageContainer>
  );
}
