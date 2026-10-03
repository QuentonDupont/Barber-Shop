import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { ShopfrontManager } from "@/components/business/shopfront-manager";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Shopfront" };

export default async function ShopfrontPage() {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const businessId = ctx.business.id;

  const [{ data: products }, { data: campaigns }, { data: orders }, { data: subscriptions }] =
    await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("business_id", businessId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("campaigns")
        .select("*")
        .eq("business_id", businessId)
        .order("starts_at", { ascending: true }),
      supabase
        .from("orders")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false }),
      supabase.from("campaign_subscriptions").select("*").eq("business_id", businessId),
    ]);

  return (
    <PageContainer>
      <PageHeader
        title="Shopfront"
        description="Sell merch, run events and sales, and see what customers have bought and signed up for."
      />
      <ShopfrontManager
        products={products ?? []}
        campaigns={campaigns ?? []}
        orders={orders ?? []}
        subscriptions={subscriptions ?? []}
        timezone={ctx.business.timezone}
      />
    </PageContainer>
  );
}
