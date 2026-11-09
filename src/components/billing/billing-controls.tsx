"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cancelPlanAction, demoCardAction, demoScenarioAction } from "@/lib/actions/billing";
import { idleState, type ActionState } from "@/lib/actions/types";
import type { BillingCard } from "@/lib/billing/repo";
import { useT } from "@/lib/i18n/context";

function useToastOn(state: ActionState) {
  useEffect(() => {
    if (state.status === "success" && state.message) toast.success(state.message);
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);
}

function Submit({ children, variant = "outline", testId }: { children: React.ReactNode; variant?: "outline" | "accent" | "ghost"; testId?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="md" variant={variant} loading={pending} data-testid={testId}>
      {children}
    </Button>
  );
}

/** Payment method: a pretend card, added with one click. No card number is ever typed. */
export function PaymentMethodCard({ card, canChange }: { card: BillingCard | null; canChange: boolean }) {
  const t = useT();
  const [state, action] = useActionState(demoCardAction, idleState);
  useToastOn(state);
  return (
    <Card data-testid="payment-method">
      <CardHeader>
        <CardTitle>{t("billing.cardTitle")}</CardTitle>
        <CardDescription>{t("billing.cardDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {card ? (
          <div className="flex items-center gap-3">
            <CreditCard className="size-6 text-fg-muted" aria-hidden />
            <div className="min-w-0">
              <p className="font-medium">
                {t("billing.cardLine", {
                  brand: card.brand,
                  last4: card.last4,
                  month: String(card.expMonth).padStart(2, "0"),
                  year: card.expYear,
                })}
              </p>
              <Badge tone="warning">{t("billing.cardDemoTag")}</Badge>
            </div>
          </div>
        ) : (
          <p className="text-sm text-fg-muted">{t("billing.noCard")}</p>
        )}
        {canChange ? (
          card ? (
            <form action={action}>
              <input type="hidden" name="remove" value="true" />
              <Submit testId="remove-card">{t("billing.removeCard")}</Submit>
            </form>
          ) : (
            <form action={action}>
              <Submit variant="accent" testId="add-card">
                {t("billing.addDemoCard")}
              </Submit>
            </form>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

export function CancelControls({ cancelling, canChange }: { cancelling: boolean; canChange: boolean }) {
  const t = useT();
  const [state, action] = useActionState(cancelPlanAction, idleState);
  useToastOn(state);
  if (!canChange) return null;
  return (
    <form action={action}>
      {cancelling ? <input type="hidden" name="undo" value="true" /> : null}
      <Submit testId={cancelling ? "undo-cancel" : "cancel-plan"}>
        {cancelling ? t("billing.undoCancel") : t("billing.cancelPlan")}
      </Submit>
    </form>
  );
}

/** Demo only: run the real state machine through a missed payment to see the owner notices. */
export function DemoControls() {
  const t = useT();
  const [state, action] = useActionState(demoScenarioAction, idleState);
  useToastOn(state);
  const items: { scenario: string; label: string }[] = [
    { scenario: "failed", label: t("billing.scenFailed") },
    { scenario: "grace", label: t("billing.scenGrace") },
    { scenario: "lapsed", label: t("billing.scenLapsed") },
    { scenario: "reset", label: t("billing.scenReset") },
  ];
  return (
    <Card data-testid="demo-controls">
      <CardHeader>
        <CardTitle>{t("billing.demoControlsTitle")}</CardTitle>
        <CardDescription>{t("billing.demoControlsHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {items.map((i) => (
          <form key={i.scenario} action={action}>
            <input type="hidden" name="scenario" value={i.scenario} />
            <Submit testId={`scenario-${i.scenario}`}>{i.label}</Submit>
          </form>
        ))}
      </CardContent>
    </Card>
  );
}
