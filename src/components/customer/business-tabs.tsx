"use client";

import { ShoppingBag, Ticket } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/misc";
import type { CampaignRow, ProductRow } from "@/lib/database.types";
import { ProductBuyCard } from "./product-buy-card";
import { CampaignCard } from "./campaign-card";
import { useT } from "@/lib/i18n/context";

/**
 * A business page is a shopfront: book a service, buy merch, or see what's on.
 * The booking flow is rendered on the server and passed in as an element so its
 * heavy availability props don't have to be threaded through here.
 */
export function BusinessTabs({
  booking,
  products,
  campaigns,
  timezone,
  subscribedIds,
}: {
  booking: React.ReactNode;
  products: ProductRow[];
  campaigns: CampaignRow[];
  timezone: string;
  subscribedIds: string[];
}) {
  const subscribed = new Set(subscribedIds);
  const t = useT();

  return (
    <Tabs defaultValue="book">
      <TabsList className="w-full max-w-md">
        <TabsTrigger value="book">{t("ui.tabBook")}</TabsTrigger>
        <TabsTrigger value="shop">
          {t("ui.tabShop")}
          {products.length > 0 ? ` (${products.length})` : ""}
        </TabsTrigger>
        <TabsTrigger value="whatson">
          {t("ui.tabWhatsOn")}
          {campaigns.length > 0 ? ` (${campaigns.length})` : ""}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="book">{booking}</TabsContent>

      <TabsContent value="shop">
        {products.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={t("ui.shopEmptyTitle")}
            description={t("ui.shopEmptyDescription")}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {products.map((product) => (
              <ProductBuyCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="whatson">
        {campaigns.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title={t("ui.whatsOnEmptyTitle")}
            description={t("ui.whatsOnEmptyDescription")}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                timezone={timezone}
                subscribed={subscribed.has(campaign.id)}
              />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
