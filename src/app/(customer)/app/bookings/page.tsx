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
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "My bookings" };

export default async function BookingsPage() {
  const session = await requireCustomer();
  const supabase = await createClient();
  const locale = await getLocale();

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
        title={t(locale, "myBookings.title")}
        description={t(locale, "myBookings.description")}
      />

      <Tabs defaultValue="upcoming">
        <TabsList className="w-full max-w-sm">
          <TabsTrigger value="upcoming">
            {t(locale, "myBookings.upcoming")}
            {upcoming.length > 0 ? ` (${upcoming.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="past">{t(locale, "myBookings.history")}</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <BookingList
            bookings={upcoming}
            emptyState={
              <EmptyState
                icon={CalendarCheck}
                title={t(locale, "myBookings.upcomingEmptyTitle")}
                description={t(locale, "myBookings.upcomingEmptyDescription")}
                action={
                  <Button asChild variant="accent" size="lg">
                    <Link href="/app">{t(locale, "myBookings.findAPlace")}</Link>
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
                title={t(locale, "myBookings.pastEmptyTitle")}
                description={t(locale, "myBookings.pastEmptyDescription")}
              />
            }
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
