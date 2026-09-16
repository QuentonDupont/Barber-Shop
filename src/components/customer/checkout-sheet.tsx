"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Check, CreditCard, QrCode, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { idleState, type ActionState } from "@/lib/actions/types";
import { formatMoney } from "@/lib/booking/time";
import { accentTile } from "@/lib/shop";
import { cn } from "@/lib/utils";

type PayAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * A mock checkout used for both merch and paid events. It offers card (Stripe)
 * and scan-to-pay, records the order/subscription through `action`, and never
 * takes real money — real payment gets wired in later.
 */
export function CheckoutSheet({
  open,
  onOpenChange,
  emoji,
  accent,
  title,
  summary,
  amount,
  currency = "THB",
  action,
  hidden,
  cta,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emoji?: string | null;
  accent?: string | null;
  title: string;
  summary?: string;
  amount: number;
  currency?: string;
  action: PayAction;
  hidden: Record<string, string>;
  cta?: string;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const [method, setMethod] = useState<"stripe" | "scan">("stripe");

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Done.");
      onOpenChange(false);
      onSuccess?.();
    }
  }, [state, onOpenChange, onSuccess]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Checkout</SheetTitle>
          <SheetDescription>Choose how you&rsquo;d like to pay.</SheetDescription>
        </SheetHeader>

        <form action={formAction}>
          <SheetBody>
            {state.status === "error" && state.message ? (
              <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger" role="alert">
                {state.message}
              </p>
            ) : null}

            {Object.entries(hidden).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <input type="hidden" name="paymentMethod" value={method} />

            {/* Line item */}
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-muted/60 p-3">
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl text-xl",
                  accentTile(accent),
                )}
                aria-hidden
              >
                {emoji || "🛍️"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{title}</p>
                {summary ? <p className="truncate text-sm text-fg-muted">{summary}</p> : null}
              </div>
              <span className="shrink-0 font-bold">{formatMoney(amount, currency)}</span>
            </div>

            {/* Payment method — card-style radios */}
            <fieldset className="space-y-2.5">
              <legend className="mb-1 text-sm font-semibold">Payment method</legend>
              <PaymentOption
                active={method === "stripe"}
                onSelect={() => setMethod("stripe")}
                icon={<CreditCard className="size-5" />}
                title="Pay by card"
                subtitle="Visa, Mastercard, Amex — via Stripe"
              />
              <PaymentOption
                active={method === "scan"}
                onSelect={() => setMethod("scan")}
                icon={<QrCode className="size-5" />}
                title="Scan to pay"
                subtitle="PromptPay / your banking app"
              />

              {method === "scan" ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-4">
                  <div className="rounded-xl bg-white p-2.5 shadow-sm">
                    <FakeQR seed={`${title}-${amount}`} />
                  </div>
                  <p className="text-center text-xs text-fg-subtle">
                    Scan with any banking app. Demo QR — no real charge.
                  </p>
                </div>
              ) : null}
            </fieldset>
          </SheetBody>

          <SheetFooter className="flex-col gap-2 sm:flex-col">
            <PayButton amount={amount} currency={currency} method={method} cta={cta} />
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-fg-subtle">
              <ShieldCheck className="size-3.5" />
              Demo checkout — you won&rsquo;t be charged.
            </p>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function PaymentOption({
  active,
  onSelect,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
        active
          ? "border-accent bg-accent-soft/50 ring-2 ring-accent/30"
          : "border-border bg-surface hover:border-border-strong",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-accent text-accent-fg" : "bg-surface-muted text-fg-muted",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block truncate text-sm text-fg-muted">{subtitle}</span>
      </span>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          active ? "border-accent bg-accent text-accent-fg" : "border-border-strong",
        )}
        aria-hidden
      >
        {active ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

function PayButton({
  amount,
  currency,
  method,
  cta,
}: {
  amount: number;
  currency: string;
  method: "stripe" | "scan";
  cta?: string;
}) {
  const { pending } = useFormStatus();
  const label = cta ?? (amount > 0 ? `Pay ${formatMoney(amount, currency)}` : "Confirm");
  return (
    <Button type="submit" size="lg" variant="accent" block loading={pending}>
      {method === "scan" ? <QrCode /> : <CreditCard />}
      {label}
    </Button>
  );
}

/** A decorative, non-functional QR code. Deterministic from `seed`. */
function FakeQR({ seed }: { seed: string }) {
  const N = 25;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };

  const isFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);

  const cells: React.ReactElement[] = [];
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      if (isFinder(x, y)) continue;
      if (rand() > 0.52) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
    }
  }

  const finder = (fx: number, fy: number) => (
    <g key={`f-${fx}-${fy}`}>
      <rect x={fx} y={fy} width={7} height={7} />
      <rect x={fx + 1} y={fy + 1} width={5} height={5} fill="#fff" />
      <rect x={fx + 2} y={fy + 2} width={3} height={3} />
    </g>
  );

  return (
    <svg
      viewBox={`0 0 ${N} ${N}`}
      className="size-40"
      shapeRendering="crispEdges"
      fill="#0f172a"
      role="img"
      aria-label="Demo QR code"
    >
      {cells}
      {finder(0, 0)}
      {finder(N - 7, 0)}
      {finder(0, N - 7)}
    </svg>
  );
}
