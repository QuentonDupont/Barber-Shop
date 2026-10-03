import type { Metadata } from "next";
import { Store } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { Discover } from "@/components/customer/discover";
import { EmptyState } from "@/components/ui/misc";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Explore" };

export default async function ExplorePage() {
  const session = await requireCustomer();
  const supabase = await createClient();

  // One query with the services embedded: the list needs a "from" price and a
  // service count, and a second round trip per business would be N+1.
  const { data } = await supabase
    .from("businesses")
    .select(
      "id, slug, name, category, description, address, lat, lng, services(price, currency, is_active)",
    )
    .eq("is_published", true)
    .order("name", { ascending: true })
    .limit(200);

  const listings = (data ?? []).map((business) => {
    const active = business.services.filter((service) => service.is_active);
    const prices = active.map((service) => Number(service.price));

    return {
      id: business.id,
      slug: business.slug,
      name: business.name,
      category: business.category,
      description: business.description,
      address: business.address,
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
        title={firstName ? `Hi ${firstName}` : "Explore"}
        description="Find a place near you and book a time that actually works."
      />

      {listings.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No businesses are live yet"
          description="Bookly is brand new here. Once shops publish their pages they will show up in this list."
        />
      ) : (
        <Discover businesses={listings} />
      )}
    </PageContainer>
  );
}
