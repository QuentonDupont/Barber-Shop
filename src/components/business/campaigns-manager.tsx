"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { CalendarClock, Pencil, Plus, Ticket, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  deleteCampaignAction,
  saveCampaignAction,
  togglePublishCampaignAction,
} from "@/lib/actions/campaigns";
import { idleState } from "@/lib/actions/types";
import type { CampaignRow } from "@/lib/database.types";
import { formatMoney } from "@/lib/booking/time";
import { accentTile, formatCampaignWhen, zonedParts } from "@/lib/shop";
import { useLocale, useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import { AccentPicker } from "./shop-fields";

export function CampaignsManager({
  campaigns,
  timezone,
}: {
  campaigns: CampaignRow[];
  timezone: string;
}) {
  const t = useT();
  const [editing, setEditing] = useState<CampaignRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      {campaigns.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={t("shopfrontAdmin.campaignsEmptyTitle")}
          description={t("shopfrontAdmin.campaignsEmptyDescription")}
          action={
            <Button variant="accent" size="lg" onClick={() => setCreating(true)}>
              <Plus />
              {t("shopfrontAdmin.createFirstCampaign")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} timezone={timezone} onEdit={setEditing} />
          ))}
        </div>
      )}

      {campaigns.length > 0 ? (
        <>
          <Button variant="accent" size="md" onClick={() => setCreating(true)} className="mt-4 hidden sm:inline-flex">
            <Plus />
            {t("shopfrontAdmin.newCampaign")}
          </Button>
          {/* Clearance so the last row can scroll clear of the sticky bar. */}
          <div className="h-[4.5rem] sm:hidden" aria-hidden />

          {/* A circular FAB pinned to the right sat on top of each row's toggle
              and edit controls, which are right-aligned too, and won the tap.
              A full-width bar above the tab bar keeps it in thumb reach without
              ever covering a row. Mirrors the booking flow's sticky bar. */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface p-3 pb-nav sm:hidden">
            <Button variant="accent" size="lg" block onClick={() => setCreating(true)}>
              <Plus />
              {t("shopfrontAdmin.newCampaign")}
            </Button>
          </div>
        </>
      ) : null}

      <CampaignSheet
        key={editing?.id ?? (creating ? "new" : "closed")}
        campaign={editing}
        timezone={timezone}
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />
    </>
  );
}

function CampaignCard({
  campaign,
  timezone,
  onEdit,
}: {
  campaign: CampaignRow;
  timezone: string;
  onEdit: (campaign: CampaignRow) => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const isEvent = campaign.kind === "event";
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border bg-surface p-3",
        !campaign.is_published && "opacity-70",
      )}
    >
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl",
          accentTile(campaign.accent),
        )}
        aria-hidden
      >
        {campaign.image_emoji || (isEvent ? "🎟️" : "🏷️")}
      </span>

      <button
        type="button"
        onClick={() => onEdit(campaign)}
        className="min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={isEvent ? "accent" : "info"}>
            {isEvent ? t("shopfrontAdmin.eventBadge") : t("shopfrontAdmin.saleBadge")}
          </Badge>
          {campaign.is_published ? (
            <Badge tone="success">{t("shopfrontAdmin.liveBadge")}</Badge>
          ) : (
            <Badge tone="neutral">{t("shopfrontAdmin.draftBadge")}</Badge>
          )}
        </span>
        <span className="mt-1 block truncate font-semibold">{campaign.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-sm text-fg-muted">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3.5" />
            {formatCampaignWhen(campaign, timezone, locale)}
          </span>
          {isEvent && campaign.price > 0 ? (
            <span className="font-semibold text-fg">{formatMoney(campaign.price, campaign.currency)}</span>
          ) : null}
          {isEvent && campaign.price === 0 ? (
            <span className="font-semibold text-fg">{t("shopfrontAdmin.free")}</span>
          ) : null}
          {!isEvent && campaign.discount_label ? (
            <span className="font-semibold text-fg">{campaign.discount_label}</span>
          ) : null}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <PublishToggle campaign={campaign} />
        <button
          type="button"
          onClick={() => onEdit(campaign)}
          className="flex size-11 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"
          aria-label={t("shopfrontAdmin.editCampaignName", { title: campaign.title })}
        >
          <Pencil className="size-4" />
        </button>
      </div>
    </div>
  );
}

function PublishToggle({ campaign }: { campaign: CampaignRow }) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={togglePublishCampaignAction} className="flex items-center">
      <input type="hidden" name="id" value={campaign.id} />
      <input type="hidden" name="isPublished" value={String(!campaign.is_published)} />
      <Switch
        checked={campaign.is_published}
        onCheckedChange={() => formRef.current?.requestSubmit()}
        aria-label={
          campaign.is_published
            ? t("shopfrontAdmin.unpublishName", { title: campaign.title })
            : t("shopfrontAdmin.publishName", { title: campaign.title })
        }
      />
    </form>
  );
}

function KindToggle({ value, onChange }: { value: "event" | "sale"; onChange: (v: "event" | "sale") => void }) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1">
      <input type="hidden" name="kind" value={value} />
      {(["event", "sale"] as const).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          aria-pressed={value === k}
          className={cn(
            "flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors",
            value === k ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg",
          )}
        >
          {k === "event" ? <Ticket className="size-4" /> : <Users className="size-4" />}
          {k === "event" ? t("shopfrontAdmin.eventBadge") : t("shopfrontAdmin.saleBadge")}
        </button>
      ))}
    </div>
  );
}

function CampaignSheet({
  campaign,
  timezone,
  open,
  onOpenChange,
}: {
  campaign: CampaignRow | null;
  timezone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [state, formAction] = useActionState(saveCampaignAction, idleState);
  const [deleteState, deleteAction] = useActionState(deleteCampaignAction, idleState);
  const [kind, setKind] = useState<"event" | "sale">(campaign?.kind ?? "event");
  const [isPublished, setIsPublished] = useState(campaign?.is_published ?? true);
  const errors = state.fieldErrors ?? {};

  const start = zonedParts(campaign?.starts_at ?? null, timezone);
  const end = zonedParts(campaign?.ends_at ?? null, timezone);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? t("common.saved"));
      onOpenChange(false);
    }
  }, [state, onOpenChange, t]);

  useEffect(() => {
    if (deleteState.status === "success") {
      toast.success(deleteState.message ?? t("common.deleted"));
      onOpenChange(false);
    }
    if (deleteState.status === "error" && deleteState.message) toast.error(deleteState.message);
  }, [deleteState, onOpenChange, t]);

  const isEvent = kind === "event";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{campaign ? t("shopfrontAdmin.editCampaign") : t("shopfrontAdmin.newCampaignTitle")}</SheetTitle>
          <SheetDescription>
            {t("shopfrontAdmin.campaignDescEventIntro")}
            <strong>{t("shopfrontAdmin.campaignDescEventWord")}</strong>
            {t("shopfrontAdmin.campaignDescEventRest")}
            {t("shopfrontAdmin.campaignDescSaleIntro")}
            <strong>{t("shopfrontAdmin.campaignDescSaleWord")}</strong>
            {t("shopfrontAdmin.campaignDescSaleRest")}
          </SheetDescription>
        </SheetHeader>

        <form action={formAction}>
          <SheetBody>
            {state.status === "error" && state.message ? (
              <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger" role="alert">
                {state.message}
              </p>
            ) : null}

            <input type="hidden" name="id" value={campaign?.id ?? ""} />

            <KindToggle value={kind} onChange={setKind} />

            <div className="grid grid-cols-[5rem_1fr] gap-3">
              <Field label={t("shopfrontAdmin.emojiLabel")} htmlFor="campaign-emoji">
                <Input
                  id="campaign-emoji"
                  name="imageEmoji"
                  defaultValue={campaign?.image_emoji ?? ""}
                  placeholder={isEvent ? "🎟️" : "🏷️"}
                  className="text-center text-2xl"
                  maxLength={8}
                />
              </Field>
              <Field label={t("shopfrontAdmin.titleLabel")} htmlFor="campaign-title" error={errors.title} required>
                <Input
                  id="campaign-title"
                  name="title"
                  defaultValue={campaign?.title ?? ""}
                  placeholder={
                    isEvent
                      ? t("shopfrontAdmin.eventTitlePlaceholder")
                      : t("shopfrontAdmin.saleTitlePlaceholder")
                  }
                  autoFocus
                  required
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label={isEvent ? t("shopfrontAdmin.dateLabel") : t("shopfrontAdmin.startsLabel")}
                htmlFor="campaign-date"
                error={errors.date}
                required
              >
                <Input id="campaign-date" name="date" type="date" defaultValue={start.date} required />
              </Field>
              <Field
                label={isEvent ? t("shopfrontAdmin.timeLabel") : t("shopfrontAdmin.fromOptionalLabel")}
                htmlFor="campaign-time"
              >
                <Input
                  id="campaign-time"
                  name="time"
                  type="time"
                  defaultValue={start.time || (isEvent ? "18:00" : "")}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label={isEvent ? t("shopfrontAdmin.endsOptionalLabel") : t("shopfrontAdmin.endsLabel")}
                htmlFor="campaign-endDate"
                error={errors.endDate}
              >
                <Input id="campaign-endDate" name="endDate" type="date" defaultValue={end.date} />
              </Field>
              <Field label={t("shopfrontAdmin.endTimeLabel")} htmlFor="campaign-endTime">
                <Input id="campaign-endTime" name="endTime" type="time" defaultValue={end.time} />
              </Field>
            </div>

            {isEvent ? (
              <>
                <Field label={t("shopfrontAdmin.locationLabel")} htmlFor="campaign-location" hint={t("shopfrontAdmin.locationHint")}>
                  <Input
                    id="campaign-location"
                    name="location"
                    defaultValue={campaign?.location ?? ""}
                    placeholder={t("shopfrontAdmin.locationPlaceholder")}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("shopfrontAdmin.ticketPriceLabel")} htmlFor="campaign-price" hint={t("shopfrontAdmin.ticketPriceHint")}>
                    <Input
                      id="campaign-price"
                      name="price"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="1"
                      defaultValue={campaign?.price ?? 0}
                    />
                  </Field>
                  <Field label={t("shopfrontAdmin.capacityLabel")} htmlFor="campaign-capacity" hint={t("shopfrontAdmin.capacityHint")}>
                    <Input
                      id="campaign-capacity"
                      name="capacity"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      defaultValue={campaign?.capacity ?? ""}
                      placeholder="∞"
                    />
                  </Field>
                </div>
              </>
            ) : (
              <Field label={t("shopfrontAdmin.offerLabel")} htmlFor="campaign-discount" hint={t("shopfrontAdmin.offerHint")}>
                <Input
                  id="campaign-discount"
                  name="discountLabel"
                  defaultValue={campaign?.discount_label ?? ""}
                  placeholder={t("shopfrontAdmin.offerPlaceholder")}
                />
              </Field>
            )}

            <Field label={t("servicesAdmin.descriptionLabel")} htmlFor="campaign-description" hint={t("shopfrontAdmin.campaignDescriptionHint")}>
              <Textarea
                id="campaign-description"
                name="description"
                defaultValue={campaign?.description ?? ""}
                placeholder={
                  isEvent
                    ? t("shopfrontAdmin.eventDescriptionPlaceholder")
                    : t("shopfrontAdmin.saleDescriptionPlaceholder")
                }
                maxLength={800}
              />
            </Field>

            <Field label={t("shopfrontAdmin.cardColour")}>
              <AccentPicker defaultValue={campaign?.accent ?? "amber"} />
            </Field>

            <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-surface-muted px-3.5">
              <label htmlFor="campaign-published" className="text-sm font-medium">
                {t("shopfrontAdmin.publishedVisible")}
              </label>
              <Switch id="campaign-published" checked={isPublished} onCheckedChange={setIsPublished} />
              <input type="hidden" name="isPublished" value={isPublished ? "on" : "off"} />
            </div>
          </SheetBody>

          <SheetFooter className="sm:justify-between">
            {campaign ? (
              <DeleteButton id={campaign.id} action={deleteAction} />
            ) : (
              <span className="hidden sm:block" />
            )}
            <SaveButton isNew={!campaign} />
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function SaveButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" size="lg" variant="accent" loading={pending} className="sm:w-auto">
      {isNew ? t("shopfrontAdmin.createCampaign") : t("shopfrontAdmin.saveChanges")}
    </Button>
  );
}

function DeleteButton({ id, action }: { id: string; action: (formData: FormData) => void }) {
  const t = useT();
  return (
    <Button
      type="button"
      variant="ghost"
      size="md"
      className="text-danger sm:w-auto"
      onClick={() => {
        const data = new FormData();
        data.set("id", id);
        action(data);
      }}
    >
      <Trash2 />
      {t("shopfrontAdmin.delete")}
    </Button>
  );
}
