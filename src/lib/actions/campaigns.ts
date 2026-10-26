"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession, requireBusiness } from "@/lib/auth";
import { parseTimeToMinutes, zonedDayMinutesToUtc } from "@/lib/booking/time";
import { errorState, fieldErrorsFrom, successState, type ActionState } from "./types";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

// Not exported: a "use server" module may only export async functions.
const CAMPAIGN_ACCENTS = ["amber", "rose", "emerald", "sky", "violet"] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* -------------------------------------------------------------------------- */
/* Owner: manage campaigns (events & sales)                                    */
/* -------------------------------------------------------------------------- */

const campaignSchema = (locale: Locale) =>
  z.object({
    id: z.string().trim().optional(),
    kind: z.enum(["event", "sale"]),
    title: z.string().trim().min(2, t(locale, "msg.campaignTitleRequired")).max(100),
    description: z.string().trim().max(800).optional().or(z.literal("")),
    date: z.string().regex(DATE_RE, t(locale, "msg.pickDate")),
    time: z.string().optional().or(z.literal("")),
    endDate: z.string().optional().or(z.literal("")),
    endTime: z.string().optional().or(z.literal("")),
    location: z.string().trim().max(240).optional().or(z.literal("")),
    price: z.coerce.number().min(0).max(1_000_000),
    capacity: z.string().trim().optional(),
    discountLabel: z.string().trim().max(60).optional().or(z.literal("")),
    imageEmoji: z.string().trim().max(8).optional().or(z.literal("")),
    accent: z.enum(CAMPAIGN_ACCENTS).catch("amber"),
    isPublished: z.boolean(),
  });

export async function saveCampaignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = await getLocale();
  const parsed = campaignSchema(locale).safeParse({
    id: formData.get("id") ?? "",
    kind: formData.get("kind"),
    title: formData.get("title"),
    description: formData.get("description"),
    date: formData.get("date"),
    time: formData.get("time"),
    endDate: formData.get("endDate"),
    endTime: formData.get("endTime"),
    location: formData.get("location"),
    price: formData.get("price") || 0,
    capacity: formData.get("capacity") ?? "",
    discountLabel: formData.get("discountLabel"),
    imageEmoji: formData.get("imageEmoji"),
    accent: formData.get("accent"),
    isPublished: formData.get("isPublished") === "on",
  });

  if (!parsed.success) {
    return errorState(
      t(locale, "msg.checkFields"),
      fieldErrorsFrom(z.flattenError(parsed.error).fieldErrors),
    );
  }

  const ctx = await requireBusiness();
  const tz = ctx.business.timezone;
  const p = parsed.data;

  const startMinutes = p.time ? parseTimeToMinutes(p.time) : 0;
  const starts_at = zonedDayMinutesToUtc(p.date, startMinutes, tz).toISOString();

  let ends_at: string | null = null;
  if (p.endDate && DATE_RE.test(p.endDate)) {
    const endMinutes = p.endTime ? parseTimeToMinutes(p.endTime) : 1439; // end of day
    const end = zonedDayMinutesToUtc(p.endDate, endMinutes, tz);
    if (end.getTime() < zonedDayMinutesToUtc(p.date, startMinutes, tz).getTime()) {
      return errorState(t(locale, "msg.endBeforeStart"), { endDate: t(locale, "msg.endBeforeStartField") });
    }
    ends_at = end.toISOString();
  }

  const capacityValue =
    p.capacity && p.capacity.length > 0 ? Math.max(1, Math.trunc(Number(p.capacity))) : null;

  const payload = {
    kind: p.kind,
    title: p.title,
    description: p.description || null,
    starts_at,
    ends_at,
    location: p.kind === "event" ? p.location || null : null,
    price: p.kind === "event" ? p.price : 0,
    currency: "THB",
    capacity: p.kind === "event" ? (Number.isFinite(capacityValue as number) ? capacityValue : null) : null,
    discount_label: p.kind === "sale" ? p.discountLabel || null : null,
    image_emoji: p.imageEmoji || null,
    accent: p.accent,
    is_published: p.isPublished,
  };

  const supabase = await createClient();

  if (p.id) {
    const { error } = await supabase
      .from("campaigns")
      .update(payload)
      .eq("id", p.id)
      .eq("business_id", ctx.business.id);
    if (error) return errorState(error.message);
  } else {
    const { error } = await supabase
      .from("campaigns")
      .insert({ ...payload, business_id: ctx.business.id });
    if (error) return errorState(error.message);
  }

  revalidatePath("/dashboard/shopfront");
  revalidatePath("/app/whats-on");
  revalidatePath(`/b/${ctx.business.slug}`);
  return successState(
    t(locale, p.id ? "msg.campaignUpdated" : p.isPublished ? "msg.campaignPublished" : "msg.draftSaved"),
  );
}

export async function togglePublishCampaignAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const nextPublished = formData.get("isPublished") === "true";
  if (!id) return;

  const ctx = await requireBusiness();
  const supabase = await createClient();

  await supabase
    .from("campaigns")
    .update({ is_published: nextPublished })
    .eq("id", id)
    .eq("business_id", ctx.business.id);

  revalidatePath("/dashboard/shopfront");
  revalidatePath("/app/whats-on");
  revalidatePath(`/b/${ctx.business.slug}`);
}

export async function deleteCampaignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = await getLocale();
  const id = String(formData.get("id") ?? "");
  if (!id) return errorState(t(locale, "msg.campaignGone"));

  const ctx = await requireBusiness();
  const supabase = await createClient();

  // Clear its subscriptions first (no FK enforcement in mock, but keeps data tidy).
  await supabase.from("campaign_subscriptions").delete().eq("campaign_id", id);

  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", id)
    .eq("business_id", ctx.business.id);
  if (error) return errorState(error.message);

  revalidatePath("/dashboard/shopfront");
  revalidatePath("/app/whats-on");
  revalidatePath(`/b/${ctx.business.slug}`);
  return successState(t(locale, "msg.campaignDeleted"));
}

/* -------------------------------------------------------------------------- */
/* Customer: subscribe to an event                                             */
/* -------------------------------------------------------------------------- */

const subscribeSchema = z.object({
  campaignId: z.string().trim().min(1),
  // Paid events go through the mock checkout, which passes a method.
  paymentMethod: z.enum(["stripe", "scan"]).optional(),
});

export async function subscribeCampaignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = await getLocale();
  const parsed = subscribeSchema.safeParse({
    campaignId: formData.get("campaignId"),
    paymentMethod: formData.get("paymentMethod") || undefined,
  });
  if (!parsed.success) return errorState(t(locale, "msg.unreadable"));

  const session = await getSession();
  if (!session) return errorState(t(locale, "msg.signInSubscribe"));
  if (session.profile.role !== "customer") {
    return errorState(t(locale, "msg.businessCannotSubscribe"));
  }

  const supabase = await createClient();
  const { campaignId } = parsed.data;

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("is_published", true)
    .maybeSingle();

  if (!campaign) return errorState(t(locale, "msg.eventUnavailable"));
  if (campaign.kind !== "event") return errorState(t(locale, "msg.onlyEvents"));

  // Already going?
  const { data: existing } = await supabase
    .from("campaign_subscriptions")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("customer_id", session.userId)
    .maybeSingle();

  if (existing && existing.status === "going") {
    return successState(t(locale, "msg.alreadyOnList"));
  }

  // Capacity check (count active subscribers other than a returning one).
  if (campaign.capacity !== null) {
    const { data: subs } = await supabase
      .from("campaign_subscriptions")
      .select("id, status")
      .eq("campaign_id", campaignId);
    const going = (subs ?? []).filter((s) => s.status === "going").length;
    if (going >= campaign.capacity) {
      return errorState(t(locale, "msg.eventFull"));
    }
  }

  if (existing) {
    const { error } = await supabase
      .from("campaign_subscriptions")
      .update({ status: "going" })
      .eq("id", existing.id);
    if (error) return errorState(error.message);
  } else {
    const { error } = await supabase.from("campaign_subscriptions").insert({
      campaign_id: campaignId,
      business_id: campaign.business_id,
      customer_id: session.userId,
      customer_name: session.profile.full_name || session.email || "Customer",
      status: "going",
    });
    if (error) return errorState(error.message);
  }

  revalidatePath("/dashboard/shopfront");
  revalidatePath("/app/whats-on");

  return successState(
    t(locale, campaign.price > 0 ? "msg.eventPaid" : "msg.eventJoined"),
  );
}

export async function unsubscribeCampaignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = await getLocale();
  const campaignId = String(formData.get("campaignId") ?? "");
  if (!campaignId) return errorState(t(locale, "msg.eventGone"));

  const session = await getSession();
  if (!session) return errorState(t(locale, "msg.pleaseSignIn"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("campaign_subscriptions")
    .update({ status: "cancelled" })
    .eq("campaign_id", campaignId)
    .eq("customer_id", session.userId);
  if (error) return errorState(error.message);

  revalidatePath("/dashboard/shopfront");
  revalidatePath("/app/whats-on");
  return successState(t(locale, "msg.unsubscribed"));
}
