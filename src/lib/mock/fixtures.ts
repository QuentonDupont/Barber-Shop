/**
 * In-memory seed data for mock mode. Mirrors `supabase/seed.sql` so the mock
 * app looks the same as a freshly seeded local database: two demo logins and
 * two published businesses owned by the first, plus a handful of bookings so
 * the calendar and "my bookings" screens have something to show.
 *
 * Everything here is plain data with no Node-only dependencies, so the module
 * is safe to import from any runtime.
 */

import type {
  AvailabilityOverrideRow,
  BusinessBreakRow,
  BusinessHoursRow,
  BusinessRow,
  BookingRow,
  CampaignRow,
  CampaignSubscriptionRow,
  ConsentRecordRow,
  NotificationPrefsRow,
  CustomerNoteRow,
  DeletionRequestRow,
  OrderRow,
  ProductRow,
  ProfileRow,
  ServiceRow,
  StaffRow,
  StaffServiceRow,
  UserRole,
} from "@/lib/database.types";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy/policy";

export interface MockAuthUser {
  id: string;
  email: string;
  /** Demo password. Any password is accepted in mock mode, this is just a hint. */
  password: string;
  user_metadata: {
    role: UserRole;
    full_name: string;
    phone: string | null;
    avatar_url: string | null;
  };
}

export interface MockDB {
  authUsers: MockAuthUser[];
  profiles: ProfileRow[];
  businesses: BusinessRow[];
  business_hours: BusinessHoursRow[];
  business_breaks: BusinessBreakRow[];
  services: ServiceRow[];
  staff: StaffRow[];
  /**
   * Registered for handoff 08 (runtime fix): `loadStaffWithServices`
   * (`src/lib/booking/availability.ts`) always queries this table once a
   * business has any `staff` rows at all — leaving it off `MockDB` made
   * `table_()` in `mock/client.ts` throw `unknown table "staff_services"`
   * the moment a seeded shop had barbers, a 500 that stayed hidden only
   * because no fixture business had staff yet.
   */
  staff_services: StaffServiceRow[];
  availability_overrides: AvailabilityOverrideRow[];
  bookings: BookingRow[];
  products: ProductRow[];
  campaigns: CampaignRow[];
  campaign_subscriptions: CampaignSubscriptionRow[];
  orders: OrderRow[];
  /**
   * Added for handoff 07 (PDPA). `customer_notes` was already in the real
   * schema (stretch A, `20261020120000_stretch_a_notes_and_policy.sql`) but
   * had never been registered here, so mock mode couldn't exercise it —
   * closing that gap now since the data-export feature (item 12) needs to
   * read it.
   */
  customer_notes: CustomerNoteRow[];
  consent_records: ConsentRecordRow[];
  deletion_requests: DeletionRequestRow[];
  /** Customer account: notification choices (migration 20261104000000). Empty = defaults. */
  notification_prefs: NotificationPrefsRow[];
}

const TZ = "Asia/Bangkok"; // +07:00, no DST

/* -------------------------------------------------------------------------- */
/* Time helpers — bookings are positioned relative to "today" in Bangkok.      */
/* -------------------------------------------------------------------------- */

function bangkokToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftDate(dateKey: string, days: number): string {
  const [y = 1970, m = 1, d = 1] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** A Bangkok wall-clock time on a given day, as a UTC ISO instant. */
function at(dateKey: string, time: string): string {
  return new Date(`${dateKey}T${time}:00+07:00`).toISOString();
}

function plusMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

/* -------------------------------------------------------------------------- */
/* Stable IDs                                                                  */
/* -------------------------------------------------------------------------- */

const OWNER = "a0000000-0000-4000-8000-000000000001";
const CUSTOMER = "a0000000-0000-4000-8000-000000000002";
const WALK_IN_1 = "a0000000-0000-4000-8000-000000000101";
const WALK_IN_2 = "a0000000-0000-4000-8000-000000000102";
const WALK_IN_3 = "a0000000-0000-4000-8000-000000000103";

const BARBER = "b0000000-0000-4000-8000-000000000001";
const SPA = "b0000000-0000-4000-8000-000000000002";

// Barber services
const SVC_CUT = "c0000000-0000-4000-8000-000000000001";
const SVC_FADE = "c0000000-0000-4000-8000-000000000002";
const SVC_SHAVE = "c0000000-0000-4000-8000-000000000003";
const SVC_COMBO = "c0000000-0000-4000-8000-000000000004";
// Spa services
const SVC_THAI60 = "c0000000-0000-4000-8000-000000000005";
const SVC_THAI120 = "c0000000-0000-4000-8000-000000000006";
const SVC_AROMA = "c0000000-0000-4000-8000-000000000007";

// Barber staff (roadmap.md §1 row 4 — multi-staff booking needs the demo
// shop to actually have barbers).
const STAFF_NONG = "d0000000-0000-4000-8000-000000000001";
const STAFF_PLOY = "d0000000-0000-4000-8000-000000000002";

/* -------------------------------------------------------------------------- */
/* Builder                                                                     */
/* -------------------------------------------------------------------------- */

export function buildDB(): MockDB {
  const now = new Date().toISOString();
  const today = bangkokToday();

  const profile = (
    id: string,
    role: UserRole,
    full_name: string,
    phone: string | null,
    email: string | null,
  ): ProfileRow => ({
    id,
    role,
    full_name,
    phone,
    email,
    avatar_url: null,
    pending_email: null,
    created_at: now,
    updated_at: now,
  });

  const authUsers: MockAuthUser[] = [
    {
      id: OWNER,
      email: "owner@tatnat.local",
      password: "tatnat123",
      user_metadata: {
        role: "business_owner",
        full_name: "Nong Srisuk",
        phone: "081 000 0001",
        avatar_url: null,
      },
    },
    {
      id: CUSTOMER,
      email: "customer@tatnat.local",
      password: "tatnat123",
      user_metadata: {
        role: "customer",
        full_name: "Ann Suwannee",
        phone: "081 000 0002",
        avatar_url: null,
      },
    },
  ];

  const profiles: ProfileRow[] = [
    profile(OWNER, "business_owner", "Nong Srisuk", "081 000 0001", "owner@tatnat.local"),
    profile(CUSTOMER, "customer", "Ann Suwannee", "081 000 0002", "customer@tatnat.local"),
    profile(WALK_IN_1, "customer", "Somchai Prasert", "081 111 2222", null),
    profile(WALK_IN_2, "customer", "Malee Thongdee", "081 333 4444", null),
    profile(WALK_IN_3, "customer", "Anucha Kitti", "081 555 6666", null),
  ];

  const businesses: BusinessRow[] = [
    {
      id: BARBER,
      owner_id: OWNER,
      name: "Nong Barber",
      slug: "nong-barber",
      category: "barber",
      description: "Classic cuts and hot-towel shaves, five minutes from BTS Asok.",
      timezone: TZ,
      place_id: null,
      address: "18 Sukhumvit Soi 23, Khlong Toei Nuea, Bangkok",
      lat: 13.738,
      lng: 100.5608,
      phone: "02 123 4567",
      line_id: "@nongbarber",
      cover_url: null,
      cancellation_policy: "Free up to 2 hours before your appointment; 50% charge inside that window, full charge for a no-show.",
      slot_interval_min: 15,
      min_notice_min: 60,
      max_advance_days: 60,
      auto_confirm: true,
      is_published: true,
      onboarding_step: 3,
      created_at: now,
      updated_at: now,
    },
    {
      id: SPA,
      owner_id: OWNER,
      name: "Baan Suan Spa",
      slug: "baan-suan-spa",
      category: "spa",
      description: "Thai massage and aromatherapy in a converted shophouse.",
      timezone: TZ,
      place_id: null,
      address: "99 Charoen Krung Road, Bang Rak, Bangkok",
      lat: 13.7226,
      lng: 100.5147,
      phone: "02 987 6543",
      line_id: null,
      cover_url: null,
      cancellation_policy: null,
      slot_interval_min: 30,
      min_notice_min: 120,
      max_advance_days: 45,
      auto_confirm: false,
      is_published: true,
      onboarding_step: 3,
      created_at: now,
      updated_at: now,
    },
  ];

  // Barber: open 10:00–20:00, closed Mondays (weekday 1).
  const barberHours: BusinessHoursRow[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    id: `h-barber-${weekday}`,
    business_id: BARBER,
    weekday,
    open_time: "10:00",
    close_time: "20:00",
    is_closed: weekday === 1,
  }));

  // Spa: open 09:00–21:00 every day.
  const spaHours: BusinessHoursRow[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    id: `h-spa-${weekday}`,
    business_id: SPA,
    weekday,
    open_time: "09:00",
    close_time: "21:00",
    is_closed: false,
  }));

  // Barber: lunch break 13:00–14:00 every open day.
  const barberBreaks: BusinessBreakRow[] = [0, 2, 3, 4, 5, 6].map((weekday) => ({
    id: `br-barber-${weekday}`,
    business_id: BARBER,
    weekday,
    start_time: "13:00",
    end_time: "14:00",
    label: "Lunch",
  }));

  const service = (
    id: string,
    business_id: string,
    name: string,
    description: string | null,
    duration_min: number,
    buffer_min: number,
    price: number,
    sort_order: number,
  ): ServiceRow => ({
    id,
    business_id,
    name,
    description,
    duration_min,
    buffer_min,
    price,
    currency: "THB",
    is_active: true,
    sort_order,
    created_at: now,
    updated_at: now,
  });

  const services: ServiceRow[] = [
    service(SVC_CUT, BARBER, "Men's cut", "Consultation, wash, cut and finish.", 45, 10, 350, 1),
    service(SVC_FADE, BARBER, "Skin fade", "Clipper fade with a razor finish.", 60, 10, 500, 2),
    service(SVC_SHAVE, BARBER, "Hot-towel shave", "Traditional straight-razor shave.", 30, 5, 400, 3),
    service(SVC_COMBO, BARBER, "Cut & beard", "The full service.", 90, 15, 750, 4),
    service(SVC_THAI60, SPA, "Thai massage (60 min)", null, 60, 15, 600, 1),
    service(SVC_THAI120, SPA, "Thai massage (120 min)", null, 120, 15, 1100, 2),
    service(SVC_AROMA, SPA, "Aromatherapy", "Oil massage with a scent of your choosing.", 90, 15, 1400, 3),
  ];

  /* ---- staff (multi-staff booking) --------------------------------------- */

  // Nong performs everything (no `staff_services` rows = default-open, see
  // `staffCanPerform`). Ploy is narrowed to cuts and fades only, so the
  // demo shows the "choose your barber" step actually filtering by service.
  const staff: StaffRow[] = [
    {
      id: STAFF_NONG,
      business_id: BARBER,
      name: "Nong",
      avatar_url: null,
      works_weekdays: [0, 1, 2, 3, 4, 5, 6],
      is_active: true,
      created_at: now,
    },
    {
      id: STAFF_PLOY,
      business_id: BARBER,
      name: "Ploy",
      avatar_url: null,
      works_weekdays: [1, 2, 3, 4, 5],
      is_active: true,
      created_at: now,
    },
  ];

  const staff_services: StaffServiceRow[] = [
    { staff_id: STAFF_PLOY, service_id: SVC_CUT, created_at: now },
    { staff_id: STAFF_PLOY, service_id: SVC_FADE, created_at: now },
  ];

  const availability_overrides: AvailabilityOverrideRow[] = [
    {
      id: "ovr-barber-holiday",
      business_id: BARBER,
      date: shiftDate(today, 20),
      is_closed: true,
      open_time: null,
      close_time: null,
      note: "Public holiday",
    },
  ];

  /* ---- bookings --------------------------------------------------------- */

  let seq = 0;
  const booking = (args: {
    business_id: string;
    service_id: string;
    customer_id: string;
    dateKey: string;
    time: string;
    duration_min: number;
    status: BookingRow["status"];
    source?: BookingRow["source"];
    service_name: string;
    price: number;
    customer_name: string;
    customer_phone: string | null;
    notes?: string | null;
  }): BookingRow => {
    seq += 1;
    const starts_at = at(args.dateKey, args.time);
    const ends_at = plusMinutes(starts_at, args.duration_min);
    const cancelled = args.status === "cancelled";
    return {
      id: `bk-${String(seq).padStart(3, "0")}`,
      business_id: args.business_id,
      service_id: args.service_id,
      customer_id: args.customer_id,
      staff_id: null,
      staff_name: null,
      starts_at,
      ends_at,
      status: args.status,
      source: args.source ?? "customer",
      notes: args.notes ?? null,
      service_name: args.service_name,
      price: args.price,
      currency: "THB",
      customer_name: args.customer_name,
      customer_phone: args.customer_phone,
      cancelled_at: cancelled ? now : null,
      cancelled_by: cancelled ? args.customer_id : null,
      created_at: now,
      updated_at: now,
    };
  };

  const bookings: BookingRow[] = [
    // --- Ann's own bookings (customer portal) ---
    booking({
      business_id: BARBER,
      service_id: SVC_CUT,
      customer_id: CUSTOMER,
      dateKey: shiftDate(today, 1),
      time: "11:00",
      duration_min: 45,
      status: "confirmed",
      service_name: "Men's cut",
      price: 350,
      customer_name: "Ann Suwannee",
      customer_phone: "081 000 0002",
      notes: "A bit shorter on the sides please.",
    }),
    booking({
      business_id: SPA,
      service_id: SVC_THAI60,
      customer_id: CUSTOMER,
      dateKey: shiftDate(today, 3),
      time: "15:00",
      duration_min: 60,
      status: "pending",
      service_name: "Thai massage (60 min)",
      price: 600,
      customer_name: "Ann Suwannee",
      customer_phone: "081 000 0002",
    }),
    booking({
      business_id: BARBER,
      service_id: SVC_FADE,
      customer_id: CUSTOMER,
      dateKey: shiftDate(today, -6),
      time: "16:00",
      duration_min: 60,
      status: "completed",
      service_name: "Skin fade",
      price: 500,
      customer_name: "Ann Suwannee",
      customer_phone: "081 000 0002",
    }),
    booking({
      business_id: SPA,
      service_id: SVC_AROMA,
      customer_id: CUSTOMER,
      dateKey: shiftDate(today, -12),
      time: "10:00",
      duration_min: 90,
      status: "cancelled",
      service_name: "Aromatherapy",
      price: 1400,
      customer_name: "Ann Suwannee",
      customer_phone: "081 000 0002",
    }),

    // --- Walk-in bookings at the barber (owner calendar) ---
    booking({
      business_id: BARBER,
      service_id: SVC_SHAVE,
      customer_id: WALK_IN_1,
      source: "shop",
      dateKey: today,
      time: "10:15",
      duration_min: 30,
      status: "confirmed",
      service_name: "Hot-towel shave",
      price: 400,
      customer_name: "Somchai Prasert",
      customer_phone: "081 111 2222",
    }),
    booking({
      business_id: BARBER,
      service_id: SVC_COMBO,
      customer_id: WALK_IN_2,
      source: "shop",
      dateKey: today,
      time: "14:30",
      duration_min: 90,
      status: "confirmed",
      service_name: "Cut & beard",
      price: 750,
      customer_name: "Malee Thongdee",
      customer_phone: "081 333 4444",
    }),
    booking({
      business_id: BARBER,
      service_id: SVC_CUT,
      customer_id: WALK_IN_3,
      source: "shop",
      dateKey: today,
      time: "17:00",
      duration_min: 45,
      status: "pending",
      service_name: "Men's cut",
      price: 350,
      customer_name: "Anucha Kitti",
      customer_phone: "081 555 6666",
    }),
    booking({
      business_id: BARBER,
      service_id: SVC_FADE,
      customer_id: WALK_IN_1,
      source: "shop",
      dateKey: shiftDate(today, 2),
      time: "11:30",
      duration_min: 60,
      status: "confirmed",
      service_name: "Skin fade",
      price: 500,
      customer_name: "Somchai Prasert",
      customer_phone: "081 111 2222",
    }),

    // --- Recent history at the barber, so the owner's weekly numbers page
    // (and the no-show button's undo) has something to show. Mostly
    // customer-made, a few shop-entered, a couple of no-shows. ---
    ...[
      // [days ago, time, status, source, customer]
      [-2, "10:00", "completed", "customer", WALK_IN_1, "Somchai Prasert", "081 111 2222"],
      [-2, "14:00", "no_show", "customer", WALK_IN_2, "Malee Thongdee", "081 333 4444"],
      [-3, "11:00", "completed", "customer", WALK_IN_3, "Anucha Kitti", "081 555 6666"],
      [-4, "16:00", "completed", "shop", WALK_IN_1, "Somchai Prasert", "081 111 2222"],
      [-9, "10:00", "completed", "customer", WALK_IN_2, "Malee Thongdee", "081 333 4444"],
      [-9, "13:00", "completed", "customer", WALK_IN_3, "Anucha Kitti", "081 555 6666"],
      [-10, "15:00", "no_show", "shop", WALK_IN_1, "Somchai Prasert", "081 111 2222"],
      [-16, "10:00", "completed", "customer", WALK_IN_1, "Somchai Prasert", "081 111 2222"],
      [-17, "12:00", "cancelled", "customer", WALK_IN_2, "Malee Thongdee", "081 333 4444"],
    ].map(([offset, time, status, source, customer_id, customer_name, customer_phone]) =>
      booking({
        business_id: BARBER,
        service_id: SVC_CUT,
        customer_id: customer_id as string,
        dateKey: shiftDate(today, offset as number),
        time: time as string,
        duration_min: 45,
        status: status as BookingRow["status"],
        source: source as BookingRow["source"],
        service_name: "Men's cut",
        price: 350,
        customer_name: customer_name as string,
        customer_phone: customer_phone as string,
      }),
    ),
  ];

  /* ---- products (merch) ------------------------------------------------- */

  const product = (args: {
    id: string;
    business_id: string;
    name: string;
    description: string;
    price: number;
    image_emoji: string;
    accent: string;
    stock: number | null;
    sort_order: number;
  }): ProductRow => ({
    id: args.id,
    business_id: args.business_id,
    name: args.name,
    description: args.description,
    price: args.price,
    currency: "THB",
    image_emoji: args.image_emoji,
    accent: args.accent,
    stock: args.stock,
    is_active: true,
    sort_order: args.sort_order,
    created_at: now,
    updated_at: now,
  });

  const products: ProductRow[] = [
    product({ id: "pr-barber-1", business_id: BARBER, name: "Nong Barber tee", description: "Heavyweight cotton, shop logo on the chest.", price: 450, image_emoji: "👕", accent: "amber", stock: 30, sort_order: 1 }),
    product({ id: "pr-barber-2", business_id: BARBER, name: "Beard oil · 30ml", description: "Cedar and bergamot. Softens and tames.", price: 320, image_emoji: "🧴", accent: "emerald", stock: 48, sort_order: 2 }),
    product({ id: "pr-barber-3", business_id: BARBER, name: "Matte styling clay", description: "Strong hold, no shine. 80g tin.", price: 280, image_emoji: "🪮", accent: "sky", stock: 40, sort_order: 3 }),
    product({ id: "pr-barber-4", business_id: BARBER, name: "Gift card · ฿500", description: "Any service or product. Never expires.", price: 500, image_emoji: "🎁", accent: "violet", stock: null, sort_order: 4 }),
    product({ id: "pr-spa-1", business_id: SPA, name: "Lemongrass candle", description: "Hand-poured soy wax, 40-hour burn.", price: 390, image_emoji: "🕯️", accent: "rose", stock: 22, sort_order: 1 }),
    product({ id: "pr-spa-2", business_id: SPA, name: "Herbal compress ball", description: "Traditional luk pra kob for warm massage.", price: 250, image_emoji: "🌿", accent: "emerald", stock: 35, sort_order: 2 }),
    product({ id: "pr-spa-3", business_id: SPA, name: "Spa gift set", description: "Candle, compress ball and aroma oil, boxed.", price: 1200, image_emoji: "🎁", accent: "violet", stock: 15, sort_order: 3 }),
  ];

  /* ---- campaigns (events & sales) --------------------------------------- */

  const campaigns: CampaignRow[] = [
    {
      id: "cm-barber-event", business_id: BARBER, kind: "event",
      title: "Fade Masterclass",
      description: "A two-hour, hands-on session on clipper fades and razor finishing with Nong. Tools and refreshments provided — twelve seats only.",
      starts_at: at(shiftDate(today, 7), "18:00"), ends_at: at(shiftDate(today, 7), "20:00"),
      location: "18 Sukhumvit Soi 23, Khlong Toei Nuea, Bangkok",
      price: 350, currency: "THB", capacity: 12, discount_label: null,
      image_emoji: "✂️", accent: "amber", is_published: true, created_at: now, updated_at: now,
    },
    {
      id: "cm-barber-sale", business_id: BARBER, kind: "sale",
      title: "Songkran Sale — 20% off all cuts",
      description: "Beat the heat with a fresh cut. Twenty percent off every service, walk-in or booked, all week.",
      starts_at: at(shiftDate(today, 3), "00:00"), ends_at: at(shiftDate(today, 10), "23:59"),
      location: null, price: 0, currency: "THB", capacity: null, discount_label: "20% off",
      image_emoji: "🎉", accent: "rose", is_published: true, created_at: now, updated_at: now,
    },
    {
      id: "cm-spa-event", business_id: SPA, kind: "event",
      title: "Sound Bath & Aromatherapy Evening",
      description: "Ninety minutes of Himalayan singing bowls and essential-oil relaxation in the garden courtyard. Mats and blankets provided.",
      starts_at: at(shiftDate(today, 5), "19:00"), ends_at: at(shiftDate(today, 5), "20:30"),
      location: "99 Charoen Krung Road, Bang Rak, Bangkok",
      price: 500, currency: "THB", capacity: 20, discount_label: null,
      image_emoji: "🎵", accent: "violet", is_published: true, created_at: now, updated_at: now,
    },
    {
      id: "cm-spa-sale", business_id: SPA, kind: "sale",
      title: "Midweek Massage Deal — ฿100 off",
      description: "Tuesday to Thursday, take ฿100 off any 60-minute massage. Just mention it when you book.",
      starts_at: at(shiftDate(today, 1), "00:00"), ends_at: at(shiftDate(today, 14), "23:59"),
      location: null, price: 0, currency: "THB", capacity: null, discount_label: "฿100 off",
      image_emoji: "💆", accent: "emerald", is_published: true, created_at: now, updated_at: now,
    },
  ];

  const campaign_subscriptions: CampaignSubscriptionRow[] = [
    {
      id: "sub-1", campaign_id: "cm-spa-event", business_id: SPA,
      customer_id: CUSTOMER, customer_name: "Ann Suwannee", status: "going", created_at: now,
    },
  ];

  const orders: OrderRow[] = [
    {
      id: "or-1", business_id: BARBER, customer_id: CUSTOMER, product_id: "pr-barber-2",
      product_name: "Beard oil · 30ml", quantity: 1, unit_price: 320, amount: 320,
      currency: "THB", payment_method: "stripe", status: "paid",
      customer_name: "Ann Suwannee", created_at: now,
    },
  ];

  // The demo customer's only note from the barber shop — gives "Download my
  // data" (item 12) something real to include.
  const customer_notes: CustomerNoteRow[] = [
    {
      id: "note-1",
      business_id: BARBER,
      customer_id: CUSTOMER,
      note: "Usual: skin fade, prefers quiet.",
      created_at: now,
      updated_at: now,
    },
  ];

  // The demo customer already consented under the current policy version, so
  // the account page's "Your data" section (item 11) has something to show
  // out of the box.
  const consent_records: ConsentRecordRow[] = [
    {
      id: "consent-1",
      user_id: CUSTOMER,
      policy_version: PRIVACY_POLICY_VERSION,
      consented_at: now,
      withdrawn_at: null,
    },
  ];

  const deletion_requests: DeletionRequestRow[] = [];

  return {
    authUsers,
    profiles,
    businesses,
    business_hours: [...barberHours, ...spaHours],
    business_breaks: barberBreaks,
    services,
    staff,
    staff_services,
    availability_overrides,
    bookings,
    products,
    campaigns,
    campaign_subscriptions,
    orders,
    customer_notes,
    consent_records,
    deletion_requests,
    notification_prefs: [],
  };
}
