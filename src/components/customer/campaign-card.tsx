"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarClock, Check, MapPin, Store, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CampaignRow } from "@/lib/database.types";
import { subscribeCampaignAction, unsubscribeCampaignAction } from "@/lib/actions/campaigns";
import { idleState } from "@/lib/actions/types";
import { formatMoney } from "@/lib/booking/time";
import { accentTile, formatCampaignWhen } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { CheckoutSheet } from "./checkout-sheet";

export interface FeedCampaign extends CampaignRow {
  business_name?: string | null;
  business_slug?: string | null;
  business_timezone?: string | null;
}

export function CampaignCard({
  campaign,
  timezone,
  subscribed,
}: {
  campaign: FeedCampaign;
  timezone: string;
  subscribed: boolean;
}) {
  const isEvent = campaign.kind === "event";
  const paid = isEvent && campaign.price > 0;
  const [checkout, setCheckout] = useState(false);

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-xl text-2xl",
            accentTile(campaign.accent),
          )}
          aria-hidden
        >
          {campaign.image_emoji || (isEvent ? "🎟️" : "🏷️")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={isEvent ? "accent" : "info"}>{isEvent ? "Event" : "Sale"}</Badge>
            {subscribed ? (
              <Badge tone="success">
                <Check className="size-3.5" /> Going
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 font-semibold text-balance">{campaign.title}</p>

          {campaign.business_name && campaign.business_slug ? (
            <Link
              href={`/app/b/${campaign.business_slug}`}
              className="mt-0.5 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
            >
              <Store className="size-3.5" />
              {campaign.business_name}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="size-4 text-accent" />
          {formatCampaignWhen(campaign, timezone)}
        </span>
        {isEvent && campaign.location ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4 text-accent" />
            <span className="truncate">{campaign.location}</span>
          </span>
        ) : null}
      </div>

      {campaign.description ? (
        <p className="mt-2 text-sm leading-relaxed text-fg-muted text-pretty">{campaign.description}</p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="font-bold">
          {isEvent ? (
            campaign.price > 0 ? (
              formatMoney(campaign.price, campaign.currency)
            ) : (
              <span className="text-success">Free</span>
            )
          ) : (
            <span className="text-accent">{campaign.discount_label ?? "On now"}</span>
          )}
        </span>

        {isEvent ? (
          subscribed ? (
            <UnsubscribeForm campaignId={campaign.id} />
          ) : paid ? (
            <Button variant="accent" size="md" onClick={() => setCheckout(true)}>
              <Ticket />
              Get ticket
            </Button>
          ) : (
            <SubscribeForm campaignId={campaign.id} />
          )
        ) : campaign.business_slug ? (
          <Button asChild variant="subtle" size="md">
            <Link href={`/app/b/${campaign.business_slug}`}>View shop</Link>
          </Button>
        ) : null}
      </div>

      {paid ? (
        <CheckoutSheet
          open={checkout}
          onOpenChange={setCheckout}
          emoji={campaign.image_emoji}
          accent={campaign.accent}
          title={campaign.title}
          summary={formatCampaignWhen(campaign, timezone)}
          amount={campaign.price}
          currency={campaign.currency}
          action={subscribeCampaignAction}
          hidden={{ campaignId: campaign.id }}
          cta={`Pay ${formatMoney(campaign.price, campaign.currency)}`}
        />
      ) : null}
    </div>
  );
}

function SubscribeForm({ campaignId }: { campaignId: string }) {
  const [state, action] = useActionState(subscribeCampaignAction, idleState);
  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "You're in.");
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);
  return (
    <form action={action}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <SubmitButton variant="accent" label="Subscribe" icon={<Ticket />} />
    </form>
  );
}

function UnsubscribeForm({ campaignId }: { campaignId: string }) {
  const [state, action] = useActionState(unsubscribeCampaignAction, idleState);
  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Cancelled.");
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);
  return (
    <form action={action}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <SubmitButton variant="ghost" label="Cancel" />
    </form>
  );
}

function SubmitButton({
  variant,
  label,
  icon,
}: {
  variant: "accent" | "ghost";
  label: string;
  icon?: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size="md" loading={pending}>
      {icon}
      {label}
    </Button>
  );
}
