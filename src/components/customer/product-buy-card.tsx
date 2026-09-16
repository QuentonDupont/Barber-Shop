"use client";

import { useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ProductRow } from "@/lib/database.types";
import { purchaseProductAction } from "@/lib/actions/shop";
import { formatMoney } from "@/lib/booking/time";
import { accentTile } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { CheckoutSheet } from "./checkout-sheet";

export function ProductBuyCard({ product }: { product: ProductRow }) {
  const [qty, setQty] = useState(1);
  const [checkout, setCheckout] = useState(false);

  const soldOut = product.stock === 0;
  const max = product.stock === null ? 20 : Math.min(20, product.stock);
  const lowStock = product.stock !== null && product.stock > 0 && product.stock <= 5;

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-16 shrink-0 items-center justify-center rounded-xl text-3xl",
            accentTile(product.accent),
          )}
          aria-hidden
        >
          {product.image_emoji || product.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-balance">{product.name}</p>
          {product.description ? (
            <p className="mt-0.5 line-clamp-2 text-sm text-fg-muted text-pretty">{product.description}</p>
          ) : null}
          <p className="mt-1 font-bold">{formatMoney(product.price, product.currency)}</p>
        </div>
      </div>

      {soldOut ? (
        <div className="mt-3">
          <Badge tone="neutral">Sold out</Badge>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              className="flex size-11 items-center justify-center text-fg-muted transition-colors hover:text-fg disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-8 text-center text-sm font-semibold tabular-nums">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(max, q + 1))}
              disabled={qty >= max}
              className="flex size-11 items-center justify-center text-fg-muted transition-colors hover:text-fg disabled:opacity-40"
              aria-label="Increase quantity"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <Button variant="accent" size="md" onClick={() => setCheckout(true)} className="flex-1">
            <ShoppingBag />
            Buy
          </Button>
        </div>
      )}

      {lowStock ? <p className="mt-2 text-xs font-medium text-warning">Only {product.stock} left</p> : null}

      <CheckoutSheet
        open={checkout}
        onOpenChange={setCheckout}
        emoji={product.image_emoji}
        accent={product.accent}
        title={product.name}
        summary={`${qty} × ${formatMoney(product.price, product.currency)}`}
        amount={product.price * qty}
        currency={product.currency}
        action={purchaseProductAction}
        hidden={{ productId: product.id, quantity: String(qty) }}
      />
    </div>
  );
}
