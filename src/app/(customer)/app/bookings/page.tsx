import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, History } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { BookingList, type CustomerBooking } from "@/components/customer/booking-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My bookings" };

export default async function BookingsPage() {
  const session = await requireCustomer();
  const supabase = await createClient();

  const { data } = await supabase
    .from("bookings")
    .select("*, businesses(name, slug, timezone, address, phone)")
    .eq("customer_id", session.userId)
    .order("starts_at", { ascending: false })
    .limit(200);

  const bookings: CustomerBooking[] = (data ?? []).map(({ businesses, ...booking }) => ({
    ...booking,
    business: businesses,
  }));

  const now = Date.now();
  // "Upcoming" means still live and not yet finished — a cancelled booking
  // belongs in history even if its date has not arrived.
  const upcomingIds = new Set(
    bookings
      .filter(
        (booking) =>
          (booking.status === "pending" || booking.status === "confirmed") &&
          new Date(booking.ends_at).getTime() >= now,
      )
      .map((booking) => booking.id),
  );

  const upcoming = bookings
    .filter((booking) => upcomingIds.has(booking.id))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const past = bookings.filter((booking) => !upcomingIds.has(booking.id));

  return (
    <PageContainer>
      <PageHeader
        title="My bookings"
        description="Times are shown in each shop's own time zone."
      />

      <Tabs defaultValue="upcoming">
        <TabsList className="w-full max-w-sm">
          <TabsTrigger value="upcoming">
            Upcoming{upcoming.length > 0 ? ` (${upcoming.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="past">History</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <BookingList
            bookings={upcoming}
            emptyState={
              <EmptyState
                icon={CalendarCheck}
                title="Nothing booked yet"
                description="When you book somewhere it shows up here, with directions and a one-tap cancel."
                action={
                  <Button asChild variant="accent" size="lg">
                    <Link href="/app">Find a place</Link>
                  </Button>
                }
              />
            }
          />
        </TabsContent>

        <TabsContent value="past">
          <BookingList
            bookings={past}
            emptyState={
              <EmptyState
                icon={History}
                title="No history yet"
                description="Past and cancelled bookings collect here so you can rebook in a tap."
              />
            }
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
