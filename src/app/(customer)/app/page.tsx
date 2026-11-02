import type { Metadata } from "next";
import { Store } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { Discover } from "@/components/customer/discover";
import { EmptyState } from "@/components/ui/misc";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { availabilityForRange, loadAvailabilitySources } from "@/lib/booking/availability";
import { businessToday, formatSlotTime, shiftDateKey } from "@/lib/booking/time";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Explore" };

/** How many listings get a "next free time" line. Each costs one
 * availability load, so the list stays fast however many shops there are. */
const NEXT_FREE_LIMIT = 24;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * "ว่างถัดไป วันนี้ 14:00": the first bookable start for the shop's first
 * active service, today to two days out, from the same availability engine
 * the shop page uses. Null when nothing is free (or anything fails).
 */
async function nextFreeLine(
  supabase: Supabase,
  businessId: string,
  locale: Locale,
): Promise<string | null> {
  try {
    const [{ data: business }, { data: service }] = await Promise.all([
      supabase.from("businesses").select("*").eq("id", businessId).maybeSingle(),
      supabase
        .from("services")
        .select("*")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    if (!business || !service) return null;
    const today = businessToday(business.timezone);
    const sources = await loadAvailabilitySources(supabase, business, today, shiftDateKey(today, 2));
    const days = availabilityForRange(business, service, sources, today, 3);
    const index = days.findIndex((day) => day.slots.length > 0);
    const slot = index === -1 ? null : days[index]!.slots[0]!;
    if (!slot) return null;
    const day =
      index === 0
        ? t(locale, "discover.nextFreeToday")
        : index === 1
          ? t(locale, "discover.nextFreeTomorrow")
          : t(locale, "discover.nextFreeLater");
    return t(locale, "discover.nextFree", {
      day,
      time: formatSlotTime(slot.startsAt, business.timezone, locale),
    });
  } catch {
    return null;
  }
}

export default async function ExplorePage() {
  const session = await requireCustomer();
  const locale = await getLocale();
  const supabase = await createClient();

  // One query with the services embedded: the list needs a "from" price and a
  // service count, and a second round trip per business would be N+1.
  const { data } = await supabase
    .from("businesses")
    .select(
      "id, slug, name, category, description, address, cover_url, lat, lng, services(price, currency, is_active)",
    )
    .eq("is_published", true)
    .order("name", { ascending: true })
    .limit(200);

  const rows = data ?? [];
  const nextFree = await Promise.all(
    rows.map((business, i) =>
      i < NEXT_FREE_LIMIT ? nextFreeLine(supabase, business.id, locale) : Promise.resolve(null),
    ),
  );

  const listings = rows.map((business, i) => {
    const active = business.services.filter((service) => service.is_active);
    const prices = active.map((service) => Number(service.price));

    return {
      id: business.id,
      slug: business.slug,
      name: business.name,
      category: business.category,
      description: business.description,
      address: business.address,
      coverUrl: business.cover_url,
      nextFree: nextFree[i] ?? null,
      lat: business.lat,
      lng: business.lng,
      serviceCount: active.length,
      fromPrice: prices.length > 0 ? Math.min(...prices) : null,
      currency: active[0]?.currency ?? "THB",
    };
  });

  const firstName = session.profile.full_name.split(" ")[0];

  return (
    <PageContainer>
      <PageHeader
        title={firstName ? t(locale, "customer.hi", { name: firstName }) : t(locale, "customer.explore")}
        description={t(locale, "customer.discoverIntro")}
      />

      {listings.length === 0 ? (
        <EmptyState
          icon={Store}
          title={t(locale, "customer.noBusinessesTitle")}
          description={t(locale, "customer.noBusinessesDescription")}
        />
      ) : (
        <Discover businesses={listings} />
      )}
    </PageContainer>
  );
}
