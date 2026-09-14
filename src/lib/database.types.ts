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
    };
    Enums: {
      user_role: UserRole;
      business_category: BusinessCategory;
      booking_status: BookingStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
