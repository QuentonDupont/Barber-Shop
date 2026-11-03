"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { changePlanAction } from "@/lib/actions/billing";
import { idleState } from "@/lib/actions/types";
import { formatMoney } from "@/lib/billing/invoice";
import { PLANS, PLAN_IDS, type PlanId } from "@/lib/billing/plans";
import type { PlanChangePreview } from "@/lib/billing/ui";
import { useLocale, useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export interface PickerBarber {
  id: string;
  name: string;
}

export interface PlanPickerProps {
  current: PlanId;
  foundingOffered: boolean;
  previews: Record<PlanId, PlanChangePreview>;
  /** The Free-to-Pro preview when the founding offer is used. */
  foundingPreview: PlanChangePreview | null;
  /** Active barbers, oldest first. */
  barbers: PickerBarber[];
  canChange: boolean;
}

export function PlanPicker(props: PlanPickerProps) {
  const t = useT();
  const { locale } = useLocale();
  const [target, setTarget] = useState<PlanId | null>(null);

  return (
    <section aria-labelledby="plans-title" className="space-y-3">
      <div>
        <h2 id="plans-title" className="text-lg font-semibold">
          {t("billing.plansTitle")}
        </h2>
        <p className="text-sm text-fg-muted">{t("billing.plansDescription")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {PLAN_IDS.map((id) => {
          const plan = PLANS[id];
          const isCurrent = id === props.current;
          const preview = props.previews[id];
          return (
            <div
              key={id}
              data-testid={`plan-card-${id}`}
              className={cn(
                "flex flex-col rounded-[var(--radius-panel)] border bg-surface p-4",
                isCurrent ? "border-accent ring-1 ring-accent/40" : "border-border",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[17px] font-semibold">{locale === "th" ? plan.nameTh : plan.nameEn}</h3>
                {isCurrent ? <Badge tone="accent">{t("billing.planCurrentBadge")}</Badge> : null}
              </div>
              <p className="mt-1 text-2xl font-semibold">
                {plan.priceSatang === 0
                  ? t("billing.free")
                  : t("billing.perMonth", { price: plan.priceSatang / 100 })}
              </p>
              <ul className="mt-3 flex-1 space-y-1.5 text-sm text-fg-muted">
                <Feature>{t("billing.featureBarbers", { count: plan.maxBarbers })}</Feature>
                <Feature>{t("billing.featureBookings")}</Feature>
                {id === "free" ? <Feature>{t("billing.featureFree")}</Feature> : null}
                {id !== "free" ? <Feature>{t("billing.featureProLine")}</Feature> : null}
                {id !== "free" ? <Feature>{t("billing.featureNotes")}</Feature> : null}
                {id === "studio" ? <Feature>{t("billing.featureStudio")}</Feature> : null}
              </ul>
              <Button
                className="mt-4"
                block
                size="md"
                variant={preview.kind === "upgrade" ? "accent" : "outline"}
                disabled={isCurrent || !props.canChange}
                onClick={() => setTarget(id)}
                data-testid={`choose-${id}`}
              >
                {isCurrent
                  ? t("billing.planCurrentBadge")
                  : preview.kind === "upgrade"
                    ? t("billing.upgradeTo", { plan: locale === "th" ? plan.nameTh : plan.nameEn })
                    : t("billing.downgradeTo", { plan: locale === "th" ? plan.nameTh : plan.nameEn })}
              </Button>
            </div>
          );
        })}
      </div>

      {target ? (
        <ChangeSheet
          key={target}
          target={target}
          props={props}
          onClose={() => setTarget(null)}
        />
      ) : null}
    </section>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

function ChangeSheet({
  target,
  props,
  onClose,
}: {
  target: PlanId;
  props: PlanPickerProps;
  onClose: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const [state, formAction] = useActionState(changePlanAction, idleState);
  const [founding, setFounding] = useState(false);

  const canFound = target === "pro" && props.foundingOffered && props.foundingPreview != null;
  const preview = founding && canFound ? props.foundingPreview! : props.previews[target];
  const plan = PLANS[target];
  const planName = locale === "th" ? plan.nameTh : plan.nameEn;
  const defaultKeep = props.barbers.slice(0, preview.newLimit).map((b) => b.id);
  const [keep, setKeep] = useState<string[]>(defaultKeep);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "OK");
      onClose();
    }
  }, [state, onClose]);

  const toggleKeep = (id: string) =>
    setKeep((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const monthlyPrice = target === "free" ? "" : String(plan.priceSatang / 100);

  return (
    <Sheet open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("billing.confirmTitle", { plan: planName })}</SheetTitle>
          <SheetDescription>
            {preview.kind === "upgrade" ? t("billing.confirmUpgrade") : t("billing.confirmDowngrade")}
          </SheetDescription>
        </SheetHeader>

        <form action={formAction}>
          <SheetBody className="space-y-4">
            {state.status === "error" && state.message ? (
              <Alert tone="error">{state.message}</Alert>
            ) : null}

            <input type="hidden" name="plan" value={target} />

            <div className="rounded-lg bg-surface-muted p-3 text-sm" data-testid="change-preview">
              <p className="font-semibold">
                {preview.chargeNowSatang > 0
                  ? t("billing.confirmChargeNow", { amount: formatMoney(preview.chargeNowSatang, locale) })
                  : preview.startsFounding
                    ? t("billing.confirmFoundingNow")
                    : t("billing.confirmNoCharge")}
              </p>
              <p className="mt-1 text-fg-muted">{t("billing.confirmEffective")}</p>
              {preview.losesFounding ? (
                <p className="mt-1 font-medium text-warning">{t("billing.confirmLosesFounding")}</p>
              ) : null}
            </div>

            {canFound ? (
              <label className="flex min-h-11 items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="founding"
                  className="mt-1 size-5 accent-[var(--color-accent)]"
                  checked={founding}
                  onChange={(e) => setFounding(e.target.checked)}
                />
                <span>
                  <span className="font-semibold">{t("billing.foundingCheckbox")}</span>
                  <span className="block text-fg-muted">{t("billing.foundingOffer")}</span>
                </span>
              </label>
            ) : null}

            {preview.mustChooseBarbers ? (
              <fieldset className="space-y-2" data-testid="barber-picker">
                <legend className="text-sm font-semibold">
                  {t("billing.chooseBarbersTitle", { count: preview.newLimit })}
                </legend>
                <p className="text-sm text-fg-muted">{t("billing.chooseBarbersHint")}</p>
                {props.barbers.map((b) => (
                  <label key={b.id} className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      name="keep"
                      value={b.id}
                      className="size-5 accent-[var(--color-accent)]"
                      checked={keep.includes(b.id)}
                      onChange={() => toggleKeep(b.id)}
                    />
                    <span>{b.name}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}

            {target !== "free" ? (
              <label className="flex min-h-11 items-start gap-3 text-sm">
                <input type="checkbox" name="consent" className="mt-1 size-5 accent-[var(--color-accent)]" />
                <span>{t("billing.consentLabel", { price: t("billing.consentPrice", { price: monthlyPrice }) })}</span>
              </label>
            ) : null}
          </SheetBody>

          <SheetFooter>
            <Button type="button" variant="ghost" size="lg" onClick={onClose}>
              {t("billing.cancelButton")}
            </Button>
            <ConfirmButton disabled={preview.mustChooseBarbers && keep.length !== preview.newLimit} />
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ConfirmButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" size="lg" variant="accent" loading={pending} disabled={disabled} data-testid="confirm-plan">
      {t("billing.confirmButton")}
    </Button>
  );
}
