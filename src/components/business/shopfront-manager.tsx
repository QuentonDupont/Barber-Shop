"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductsManager } from "./products-manager";
import { CampaignsManager } from "./campaigns-manager";
import { OrdersPanel } from "./orders-panel";
import type {
  CampaignRow,
  CampaignSubscriptionRow,
  OrderRow,
  ProductRow,
} from "@/lib/database.types";
import { useT } from "@/lib/i18n/context";

export function ShopfrontManager({
  products,
  campaigns,
  orders,
  subscriptions,
  timezone,
}: {
  products: ProductRow[];
  campaigns: CampaignRow[];
  orders: OrderRow[];
  subscriptions: CampaignSubscriptionRow[];
  timezone: string;
}) {
  const t = useT();
  const activity = orders.length + subscriptions.filter((s) => s.status === "going").length;

  return (
    <Tabs defaultValue="products">
      <TabsList className="w-full max-w-md">
        <TabsTrigger value="products">
          {t("shopfrontAdmin.tabProducts")}{products.length > 0 ? ` (${products.length})` : ""}
        </TabsTrigger>
        <TabsTrigger value="campaigns">
          {t("shopfrontAdmin.tabCampaigns")}{campaigns.length > 0 ? ` (${campaigns.length})` : ""}
        </TabsTrigger>
        <TabsTrigger value="orders">
          {t("shopfrontAdmin.tabOrders")}{activity > 0 ? ` (${activity})` : ""}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="products">
        <ProductsManager products={products} />
      </TabsContent>
      <TabsContent value="campaigns">
        <CampaignsManager campaigns={campaigns} timezone={timezone} />
      </TabsContent>
      <TabsContent value="orders">
        <OrdersPanel
          orders={orders}
          subscriptions={subscriptions}
          campaigns={campaigns}
          timezone={timezone}
        />
      </TabsContent>
    </Tabs>
  );
}
