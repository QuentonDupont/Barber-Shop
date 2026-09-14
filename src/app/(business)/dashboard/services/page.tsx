import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { ServicesManager } from "@/components/business/services-manager";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const ctx = await requireBusiness();
  const supabase = await createClient();

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", ctx.business.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <PageContainer>
      <PageHeader
        title="Services"
        description="What customers can book, how long each one takes and what it costs."
      />
      <ServicesManager services={services ?? []} />
    </PageContainer>
  );
}
