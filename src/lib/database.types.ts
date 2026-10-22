/**
 * Hand-maintained mirror of `supabase/migrations`.
 *
 * Regenerate with:
 *   supabase gen types typescript --project-id <ref> --schema public \
 *     > src/lib/database.types.ts
 *
 * Until a project is linked this file is the source of truth; keep it in step
 * with the migrations whenever the schema changes.
 */

export type UserRole = "customer" | "business_owner";

export type BusinessCategory =
  | "salon"
  | "barber"
  | "clinic"
  | "spa"
  | "fitness"
  | "event"
  | "other";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export type ProfileRow = {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type BusinessRow = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  category: BusinessCategory;
  description: string | null;
  timezone: string;
  place_id: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  line_id: string | null;
  cover_url: string | null;
  /** Shown on the listing page, the booking-confirmation screen and the
   *  confirmation email (roadmap.md §1 row 6). `null` until the owner sets one. */
  cancellation_policy: string | null;
  slot_interval_min: number;
  min_notice_min: number;
  max_advance_days: number;
  auto_confirm: boolean;
  is_published: boolean;
  onboarding_step: number;
  created_at: string;
  updated_at: string;
};

export type BusinessHoursRow = {
  id: string;
  business_id: string;
  weekday: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
};

export type BusinessBreakRow = {
  id: string;
  business_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  label: string;
};

export type ServiceRow = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  duration_min: number;
  buffer_min: number;
  price: number;
  currency: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type StaffRow = {
  id: string;
  business_id: string;
  name: string;
  avatar_url: string | null;
  works_weekdays: number[];
  is_active: boolean;
  created_at: string;
};

export type StaffServiceRow = {
  staff_id: string;
  service_id: string;
  created_at: string;
};

export type AvailabilityOverrideRow = {
  id: string;
  business_id: string;
  date: string;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
  note: string | null;
};

export type BookingRow = {
  id: string;
  business_id: string;
  service_id: string;
  customer_id: string;
  staff_id: string | null;
  staff_name: string | null;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  notes: string | null;
  service_name: string;
  price: number;
  currency: string;
  customer_name: string;
  customer_phone: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A barber/owner's private note on a customer — "usual: skin fade, prefers
 * quiet" — one per (business, customer) pair, never visible to the customer
 * (roadmap.md §1 row 5). Separate from `BookingRow.notes`, which is the
 * customer's own one-off note on a single booking.
 */
export type CustomerNoteRow = {
  id: string;
  business_id: string;
  customer_id: string;
  note: string;
  created_at: string;
  updated_at: string;
};

/* ---- PDPA: consent capture, deletion requests (handoff 07) --------------- */

/**
 * One row per consent event — a fresh row each time someone agrees to a
 * (possibly new) policy version, never overwritten in place. `withdrawn_at`
 * records an opt-out without deleting the history of having once consented
 * (handoff 07 items 4, 14-15). RLS: a user may only select/insert/update
 * their own row (`user_id = auth.uid()`).
 */
export type ConsentRecordRow = {
  id: string;
  user_id: string;
  policy_version: string;
  consented_at: string;
  withdrawn_at: string | null;
};

/**
 * A customer's request to delete their account/data (handoff 07 items 13,
 * 15-18). `status` starts at `"pending"`; completion is out of band for this
 * handoff (no automated purge job yet) and stamps `completed_at`. RLS: a user
 * may only select/insert their own row.
 */
export type DeletionRequestRow = {
  id: string;
  user_id: string;
  requested_at: string;
  status: string;
  completed_at: string | null;
};

/* ---- Shopfront: merch, campaigns, orders, subscriptions ------------------ */

/** A piece of merch a business sells from its shopfront. */
export type ProductRow = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  /** Lightweight placeholder art until real image uploads exist. */
  image_emoji: string | null;
  /** Tailwind-ish accent token for the card, e.g. "amber" | "rose" | "sky". */
  accent: string | null;
  /** `null` means unlimited stock. */
  stock: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CampaignKind = "event" | "sale";

/** An event (customers subscribe/RSVP) or a sale (a promotion to showcase). */
export type CampaignRow = {
  id: string;
  business_id: string;
  kind: CampaignKind;
  title: string;
  description: string | null;
  /** Event date, or the day a sale starts. */
  starts_at: string;
  /** Event end, or the last day of a sale. `null` for open-ended. */
  ends_at: string | null;
  /** Events only. */
  location: string | null;
  /** Event ticket price; `0` means free. */
  price: number;
  currency: string;
  /** Events only: max attendees. `null` for unlimited. */
  capacity: number | null;
  /** Sales only: headline like "20% off all cuts". */
  discount_label: string | null;
  image_emoji: string | null;
  accent: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type SubscriptionStatus = "going" | "interested" | "cancelled";

/** A customer subscribing to / RSVPing an event campaign. */
export type CampaignSubscriptionRow = {
  id: string;
  campaign_id: string;
  business_id: string;
  customer_id: string;
  customer_name: string;
  status: SubscriptionStatus;
  created_at: string;
};

export type OrderStatus = "paid" | "pending" | "cancelled";
export type PaymentMethod = "stripe" | "scan";

/** A merch purchase. Payment is mocked for now; `status` is set to `paid`. */
export type OrderRow = {
  id: string;
  business_id: string;
  customer_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  status: OrderStatus;
  customer_name: string;
  created_at: string;
};

type Insertable<T, Required extends keyof T, Generated extends keyof T> = Pick<
  T,
  Required
> &
  Partial<Omit<T, Required | Generated>>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Insertable<ProfileRow, "id", "created_at" | "updated_at">;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      businesses: {
        Row: BusinessRow;
        Insert: Insertable<
          BusinessRow,
          "owner_id" | "name" | "slug",
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<BusinessRow>;
        Relationships: [
          {
            foreignKeyName: "businesses_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      business_hours: {
        Row: BusinessHoursRow;
        Insert: Insertable<BusinessHoursRow, "business_id" | "weekday", "id">;
        Update: Partial<BusinessHoursRow>;
        Relationships: [
          {
            foreignKeyName: "business_hours_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      business_breaks: {
        Row: BusinessBreakRow;
        Insert: Insertable<
          BusinessBreakRow,
          "business_id" | "weekday" | "start_time" | "end_time",
          "id"
        >;
        Update: Partial<BusinessBreakRow>;
        Relationships: [
          {
            foreignKeyName: "business_breaks_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: ServiceRow;
        Insert: Insertable<
          ServiceRow,
          "business_id" | "name" | "duration_min",
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<ServiceRow>;
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      staff: {
        Row: StaffRow;
        Insert: Insertable<StaffRow, "business_id" | "name", "id" | "created_at">;
        Update: Partial<StaffRow>;
        Relationships: [
          {
            foreignKeyName: "staff_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_services: {
        Row: StaffServiceRow;
        Insert: Insertable<StaffServiceRow, "staff_id" | "service_id", "created_at">;
        Update: Partial<StaffServiceRow>;
        Relationships: [
          {
            foreignKeyName: "staff_services_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      availability_overrides: {
        Row: AvailabilityOverrideRow;
        Insert: Insertable<AvailabilityOverrideRow, "business_id" | "date", "id">;
        Update: Partial<AvailabilityOverrideRow>;
        Relationships: [
          {
            foreignKeyName: "availability_overrides_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: BookingRow;
        Insert: Insertable<
          BookingRow,
          | "business_id"
          | "service_id"
          | "customer_id"
          | "starts_at"
          | "ends_at"
          | "service_name",
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<BookingRow>;
        Relationships: [
          {
            foreignKeyName: "bookings_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_notes: {
        Row: CustomerNoteRow;
        Insert: Insertable<
          CustomerNoteRow,
          "business_id" | "customer_id",
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<CustomerNoteRow>;
        Relationships: [
          {
            foreignKeyName: "customer_notes_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      consent_records: {
        Row: ConsentRecordRow;
        Insert: Insertable<
          ConsentRecordRow,
          "user_id" | "policy_version",
          "id" | "consented_at" | "withdrawn_at"
        >;
        Update: Partial<ConsentRecordRow>;
        Relationships: [
          {
            foreignKeyName: "consent_records_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      deletion_requests: {
        Row: DeletionRequestRow;
        Insert: Insertable<
          DeletionRequestRow,
          "user_id",
          "id" | "requested_at" | "status" | "completed_at"
        >;
        Update: Partial<DeletionRequestRow>;
        Relationships: [
          {
            foreignKeyName: "deletion_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: ProductRow;
        Insert: Insertable<
          ProductRow,
          "business_id" | "name",
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<ProductRow>;
        Relationships: [];
      };
      campaigns: {
        Row: CampaignRow;
        Insert: Insertable<
          CampaignRow,
          "business_id" | "kind" | "title" | "starts_at",
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<CampaignRow>;
        Relationships: [];
      };
      campaign_subscriptions: {
        Row: CampaignSubscriptionRow;
        Insert: Insertable<
          CampaignSubscriptionRow,
          "campaign_id" | "business_id" | "customer_id",
          "id" | "created_at"
        >;
        Update: Partial<CampaignSubscriptionRow>;
        Relationships: [];
      };
      orders: {
        Row: OrderRow;
        Insert: Insertable<
          OrderRow,
          "business_id" | "customer_id" | "product_id" | "amount",
          "id" | "created_at"
        >;
        Update: Partial<OrderRow>;
        Relationships: [];
      };
    };
    // `[_ in never]: never` is the shape `supabase gen types` emits for an
    // empty group. `Record<string, never>` fails the SDK's schema constraint
    // and silently degrades every query's result type to `never`.
    Views: {
      [_ in never]: never;
    };
    Functions: {
      unique_business_slug: {
        Args: { desired: string };
        Returns: string;
      };
      busy_intervals: {
        Args: {
          target_business: string;
          from_ts: string;
          to_ts: string;
          exclude_booking?: string | null;
          target_staff?: string | null;
        };
        Returns: { starts_at: string; ends_at: string }[];
      };
    };
    Enums: {
      user_role: UserRole;
      business_category: BusinessCategory;
      booking_status: BookingStatus;
      campaign_kind: CampaignKind;
      subscription_status: SubscriptionStatus;
      order_status: OrderStatus;
      payment_method: PaymentMethod;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
