import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { WhatsOnFeed } from "@/components/customer/whats-on-feed";
import { type FeedCampaign } from "@/components/customer/campaign-card";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "What's on" };

export default async function WhatsOnPage() {
  const session = await requireCustomer();
  const supabase = await createClient();

  const [{ data: campaigns }, { data: businesses }, { data: mySubs }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("*")
      .eq("is_published", true)
      .order("starts_at", { ascending: true }),
    supabase.from("businesses").select("id, name, slug, timezone").eq("is_published", true),
    supabase
      .from("campaign_subscriptions")
      .select("campaign_id, status")
      .eq("customer_id", session.userId),
  ]);

  const bizById = new Map((businesses ?? []).map((b) => [b.id, b]));

  // Only show campaigns whose business is currently published.
  const feed: FeedCampaign[] = (campaigns ?? [])
    .filter((c) => bizById.has(c.business_id))
    .map((c) => {
      const biz = bizById.get(c.business_id);
      return {
        ...c,
        business_name: biz?.name ?? null,
        business_slug: biz?.slug ?? null,
        business_timezone: biz?.timezone ?? null,
      };
    });

  const subscribedIds = (mySubs ?? [])
    .filter((sub) => sub.status === "going")
    .map((sub) => sub.campaign_id);

  return (
    <PageContainer>
      <PageHeader
        title="What's on"
        description="Events to join and sales worth catching, from places near you."
      />
      <WhatsOnFeed campaigns={feed} subscribedIds={subscribedIds} />
    </PageContainer>
  );
}
