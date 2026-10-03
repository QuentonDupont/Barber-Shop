"use client";

import { CreditCard, Package, QrCode, Ticket, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import type { CampaignRow, CampaignSubscriptionRow, OrderRow } from "@/lib/database.types";
import { formatMoney } from "@/lib/booking/time";
import { cn } from "@/lib/utils";

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(iso));
}

export function OrdersPanel({
  orders,
  subscriptions,
  campaigns,
}: {
  orders: OrderRow[];
  subscriptions: CampaignSubscriptionRow[];
  campaigns: CampaignRow[];
}) {
  const paid = orders.filter((o) => o.status === "paid");
  const revenue = paid.reduce((sum, o) => sum + o.amount, 0);
  const going = subscriptions.filter((s) => s.status === "going");

  const events = campaigns.filter((c) => c.kind === "event");
  const byCampaign = new Map<string, CampaignSubscriptionRow[]>();
  for (const sub of going) {
    const list = byCampaign.get(sub.campaign_id) ?? [];
    list.push(sub);
    byCampaign.set(sub.campaign_id, list);
  }

  return (
    <div className="space-y-6">
      {/* ---- Merch orders ---- */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-fg-muted">
            <Package className="size-4" /> Merch orders
          </h3>
          {paid.length > 0 ? (
            <span className="text-sm text-fg-subtle">
              {formatMoney(revenue)} · {paid.length} order{paid.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {orders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No orders yet"
            description="When a customer buys a product, it shows up here with what they paid."
          />
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{order.product_name}</span>
                    <Badge tone={order.payment_method === "scan" ? "info" : "accent"}>
                      {order.payment_method === "scan" ? (
                        <>
                          <QrCode className="size-3.5" /> QR
                        </>
                      ) : (
                        <>
                          <CreditCard className="size-3.5" /> Card
                        </>
                      )}
                    </Badge>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-fg-muted">
                    {order.customer_name} · {order.quantity} × {formatMoney(order.unit_price)} · {shortDate(order.created_at)}
                  </span>
                </span>
                <span className="shrink-0 font-semibold">{formatMoney(order.amount, order.currency)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Event sign-ups ---- */}
      <section>
        <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-fg-muted">
          <Users className="size-4" /> Event sign-ups
        </h3>

        {going.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title="No sign-ups yet"
            description="Publish an event under Campaigns and the customers who subscribe will appear here."
          />
        ) : (
          <div className="space-y-3">
            {events
              .filter((event) => (byCampaign.get(event.id) ?? []).length > 0)
              .map((event) => {
                const subs = byCampaign.get(event.id) ?? [];
                const full = event.capacity !== null && subs.length >= event.capacity;
                return (
                  <div key={event.id} className="rounded-xl border border-border bg-surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold">{event.title}</p>
                      <Badge tone={full ? "warning" : "neutral"}>
                        {subs.length}
                        {event.capacity !== null ? ` / ${event.capacity}` : ""} going
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {subs.map((sub) => (
                        <span
                          key={sub.id}
                          className={cn(
                            "inline-flex items-center rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium",
                          )}
                        >
                          {sub.customer_name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>
    </div>
  );
}
