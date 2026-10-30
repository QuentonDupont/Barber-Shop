import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { ShopfrontManager } from "@/components/business/shopfront-manager";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Shopfront" };

export default async function ShopfrontPage() {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const locale = await getLocale();
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
        title={t(locale, "shopfrontAdmin.pageTitle")}
        description={t(locale, "shopfrontAdmin.pageDescription")}
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
