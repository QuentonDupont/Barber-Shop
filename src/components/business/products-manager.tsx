"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Pencil, Plus, ShoppingBag, Trash2 } from "lucide-react";
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
  deleteProductAction,
  saveProductAction,
  toggleProductAction,
} from "@/lib/actions/shop";
import { idleState } from "@/lib/actions/types";
import type { ProductRow } from "@/lib/database.types";
import { formatMoney } from "@/lib/booking/time";
import { accentTile } from "@/lib/shop";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import { AccentPicker } from "./shop-fields";

export function ProductsManager({ products }: { products: ProductRow[] }) {
  const t = useT();
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      {products.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={t("shopfrontAdmin.productsEmptyTitle")}
          description={t("shopfrontAdmin.productsEmptyDescription")}
          action={
            <Button variant="accent" size="lg" onClick={() => setCreating(true)}>
              <Plus />
              {t("shopfrontAdmin.addFirstProduct")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onEdit={setEditing} />
          ))}
        </div>
      )}

      {products.length > 0 ? (
        <>
          <Button
            variant="accent"
            size="md"
            onClick={() => setCreating(true)}
            className="mt-4 hidden sm:inline-flex"
          >
            <Plus />
            {t("shopfrontAdmin.addProduct")}
          </Button>
          {/* Clearance so the last row can scroll clear of the sticky bar. */}
          <div className="h-[4.5rem] sm:hidden" aria-hidden />

          {/* A circular FAB pinned to the right sat on top of each row's toggle
              and edit controls, which are right-aligned too, and won the tap.
              A full-width bar above the tab bar keeps it in thumb reach without
              ever covering a row. Mirrors the booking flow's sticky bar. */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 p-3 pb-nav backdrop-blur-lg sm:hidden">
            <Button variant="accent" size="lg" block onClick={() => setCreating(true)}>
              <Plus />
              {t("shopfrontAdmin.addProduct")}
            </Button>
          </div>
        </>
      ) : null}

      <ProductSheet
        key={editing?.id ?? (creating ? "new" : "closed")}
        product={editing}
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

function ProductCard({
  product,
  onEdit,
}: {
  product: ProductRow;
  onEdit: (product: ProductRow) => void;
}) {
  const t = useT();
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-surface p-3",
        !product.is_active && "opacity-60",
      )}
    >
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl",
          accentTile(product.accent),
        )}
        aria-hidden
      >
        {product.image_emoji || product.name.charAt(0).toUpperCase()}
      </span>

      <button
        type="button"
        onClick={() => onEdit(product)}
        className="min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold">{product.name}</span>
          {!product.is_active ? <Badge tone="neutral">{t("shopfrontAdmin.hidden")}</Badge> : null}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-sm">
          <span className="font-semibold text-fg">{formatMoney(product.price, product.currency)}</span>
          <span className="text-fg-subtle">
            {product.stock === null
              ? t("shopfrontAdmin.inStock")
              : product.stock === 0
                ? t("shopfrontAdmin.soldOut")
                : t("shopfrontAdmin.stockLeft", { n: product.stock })}
          </span>
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <ToggleForm product={product} />
        <button
          type="button"
          onClick={() => onEdit(product)}
          className="flex size-11 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"
          aria-label={t("shopfrontAdmin.editName", { name: product.name })}
        >
          <Pencil className="size-4" />
        </button>
      </div>
    </div>
  );
}

function ToggleForm({ product }: { product: ProductRow }) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={toggleProductAction} className="flex items-center">
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="isActive" value={String(!product.is_active)} />
      <Switch
        checked={product.is_active}
        onCheckedChange={() => formRef.current?.requestSubmit()}
        aria-label={
          product.is_active
            ? t("shopfrontAdmin.hideName", { name: product.name })
            : t("shopfrontAdmin.showName", { name: product.name })
        }
      />
    </form>
  );
}

function ProductSheet({
  product,
  open,
  onOpenChange,
}: {
  product: ProductRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [state, formAction] = useActionState(saveProductAction, idleState);
  const [deleteState, deleteAction] = useActionState(deleteProductAction, idleState);
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const errors = state.fieldErrors ?? {};

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{product ? t("shopfrontAdmin.editProduct") : t("shopfrontAdmin.newProduct")}</SheetTitle>
          <SheetDescription>{t("shopfrontAdmin.productSheetDescription")}</SheetDescription>
        </SheetHeader>

        <form action={formAction}>
          <SheetBody>
            {state.status === "error" && state.message ? (
              <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger" role="alert">
                {state.message}
              </p>
            ) : null}

            <input type="hidden" name="id" value={product?.id ?? ""} />

            <div className="grid grid-cols-[5rem_1fr] gap-3">
              <Field label={t("shopfrontAdmin.emojiLabel")} htmlFor="product-emoji">
                <Input
                  id="product-emoji"
                  name="imageEmoji"
                  defaultValue={product?.image_emoji ?? ""}
                  placeholder="👕"
                  className="text-center text-2xl"
                  maxLength={8}
                />
              </Field>
              <Field label={t("servicesAdmin.nameLabel")} htmlFor="product-name" error={errors.name} required>
                <Input
                  id="product-name"
                  name="name"
                  defaultValue={product?.name ?? ""}
                  placeholder={t("shopfrontAdmin.productNamePlaceholder")}
                  enterKeyHint="next"
                  autoFocus
                  required
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("servicesAdmin.priceLabel")} htmlFor="product-price" error={errors.price} hint={t("servicesAdmin.priceHint")}>
                <Input
                  id="product-price"
                  name="price"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="1"
                  defaultValue={product?.price ?? 0}
                />
              </Field>
              <Field label={t("shopfrontAdmin.stockLabel")} htmlFor="product-stock" hint={t("shopfrontAdmin.stockHint")}>
                <Input
                  id="product-stock"
                  name="stock"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  defaultValue={product?.stock ?? ""}
                  placeholder="∞"
                />
              </Field>
            </div>

            <Field label={t("servicesAdmin.descriptionLabel")} htmlFor="product-description" hint={t("shopfrontAdmin.campaignDescriptionHint")}>
              <Textarea
                id="product-description"
                name="description"
                defaultValue={product?.description ?? ""}
                placeholder={t("shopfrontAdmin.productDescriptionPlaceholder")}
                maxLength={400}
              />
            </Field>

            <Field label={t("shopfrontAdmin.cardColour")}>
              <AccentPicker defaultValue={product?.accent ?? "amber"} />
            </Field>

            <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-surface-muted px-3.5">
              <label htmlFor="product-active" className="text-sm font-medium">
                {t("shopfrontAdmin.visibleToCustomers")}
              </label>
              <Switch id="product-active" checked={isActive} onCheckedChange={setIsActive} />
              <input type="hidden" name="isActive" value={isActive ? "on" : "off"} />
            </div>
          </SheetBody>

          <SheetFooter className="sm:justify-between">
            {product ? (
              <DeleteButton id={product.id} action={deleteAction} />
            ) : (
              <span className="hidden sm:block" />
            )}
            <SaveButton isNew={!product} />
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
      {isNew ? t("shopfrontAdmin.addProductButton") : t("shopfrontAdmin.saveChanges")}
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
