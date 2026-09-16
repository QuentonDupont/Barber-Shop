"use client";

import { useState } from "react";
import { CalendarX } from "lucide-react";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { CampaignCard, type FeedCampaign } from "./campaign-card";

type Filter = "all" | "event" | "sale";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "event", label: "Events" },
  { value: "sale", label: "Sales" },
];

export function WhatsOnFeed({
  campaigns,
  subscribedIds,
}: {
  campaigns: FeedCampaign[];
  subscribedIds: string[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const subscribed = new Set(subscribedIds);
  const shown = campaigns.filter((c) => filter === "all" || c.kind === filter);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          const count =
            f.value === "all" ? campaigns.length : campaigns.filter((c) => c.kind === f.value).length;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={active}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors",
                active
                  ? "bg-primary text-primary-fg"
                  : "border border-border bg-surface text-fg-muted hover:bg-surface-muted",
              )}
            >
              {f.label}
              <span className={cn("text-xs", active ? "text-primary-fg/70" : "text-fg-subtle")}>{count}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title="Nothing on right now"
          description="No events or sales are live at the moment. Check back soon — this is where they'll appear."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              timezone={campaign.business_timezone ?? "Asia/Bangkok"}
              subscribed={subscribed.has(campaign.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
