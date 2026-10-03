"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession, requireBusiness } from "@/lib/auth";
import { errorState, fieldErrorsFrom, successState, type ActionState } from "./types";

// Not exported: a "use server" module may only export async functions.
const PRODUCT_ACCENTS = ["amber", "rose", "emerald", "sky", "violet"] as const;

/* -------------------------------------------------------------------------- */
/* Owner: manage merch                                                         */
/* -------------------------------------------------------------------------- */

const productSchema = z.object({
  // Mock ids are not UUIDs, so keep this a plain string. Empty means "create".
  id: z.string().trim().optional(),
  name: z.string().trim().min(2, "Give the product a name").max(80),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  price: z.coerce.number().min(0, "Price cannot be negative").max(1_000_000),
  stock: z.string().trim().optional(),
  imageEmoji: z.string().trim().max(8).optional().or(z.literal("")),
  accent: z.enum(PRODUCT_ACCENTS).catch("amber"),
  isActive: z.boolean(),
});

export async function saveProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = productSchema.safeParse({
    id: formData.get("id") ?? "",
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price") || 0,
    stock: formData.get("stock") ?? "",
    imageEmoji: formData.get("imageEmoji"),
    accent: formData.get("accent"),
    isActive: formData.get("isActive") !== "off",
  });

  if (!parsed.success) {
    return errorState(
      "Please check the highlighted fields.",
      fieldErrorsFrom(z.flattenError(parsed.error).fieldErrors),
    );
  }

  const ctx = await requireBusiness();
  const supabase = await createClient();
  const { id, name, description, price, stock, imageEmoji, accent, isActive } = parsed.data;

  const stockValue = stock && stock.length > 0 ? Math.max(0, Math.trunc(Number(stock))) : null;

  const payload = {
    name,
    description: description || null,
    price,
    currency: "THB",
    stock: Number.isFinite(stockValue as number) ? stockValue : null,
    image_emoji: imageEmoji || null,
    accent,
    is_active: isActive,
  };

  if (id) {
    const { error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", id)
      .eq("business_id", ctx.business.id);
    if (error) return errorState(error.message);
  } else {
    const { error } = await supabase
      .from("products")
      .insert({ ...payload, business_id: ctx.business.id });
    if (error) return errorState(error.message);
  }

  revalidatePath("/dashboard/shopfront");
  revalidatePath(`/b/${ctx.business.slug}`);
  return successState(id ? "Product updated." : "Product added.");
}

export async function toggleProductAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const nextActive = formData.get("isActive") === "true";
  if (!id) return;

  const ctx = await requireBusiness();
  const supabase = await createClient();

  await supabase
    .from("products")
    .update({ is_active: nextActive })
    .eq("id", id)
    .eq("business_id", ctx.business.id);

  revalidatePath("/dashboard/shopfront");
  revalidatePath(`/b/${ctx.business.slug}`);
}

export async function deleteProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return errorState("That product no longer exists.");

  const ctx = await requireBusiness();
  const supabase = await createClient();

  // A product with orders against it is hidden rather than deleted, so past
  // orders still read correctly.
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id);

  if (count && count > 0) {
    const { error } = await supabase
      .from("products")
      .update({ is_active: false })
      .eq("id", id)
      .eq("business_id", ctx.business.id);
    if (error) return errorState(error.message);
    revalidatePath("/dashboard/shopfront");
    return successState("This product has orders against it, so it was hidden rather than deleted.");
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("business_id", ctx.business.id);
  if (error) return errorState(error.message);

  revalidatePath("/dashboard/shopfront");
  revalidatePath(`/b/${ctx.business.slug}`);
  return successState("Product deleted.");
}

/* -------------------------------------------------------------------------- */
/* Customer: buy merch (mock checkout)                                         */
/* -------------------------------------------------------------------------- */

const purchaseSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).max(20),
  paymentMethod: z.enum(["stripe", "scan"]),
});

export async function purchaseProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = purchaseSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity") || 1,
    paymentMethod: formData.get("paymentMethod") || "stripe",
  });

  if (!parsed.success) return errorState("That order could not be read. Please try again.");

  const session = await getSession();
  if (!session) return errorState("Please sign in to buy.");
  if (session.profile.role !== "customer") {
    return errorState("Business accounts cannot buy. Sign in as a customer.");
  }

  const supabase = await createClient();
  const { productId, quantity, paymentMethod } = parsed.data;

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("is_active", true)
    .maybeSingle();

  if (!product) return errorState("That product is no longer available.");
  if (product.stock !== null && product.stock < quantity) {
    return errorState(
      product.stock === 0 ? "Sorry — that item just sold out." : `Only ${product.stock} left in stock.`,
    );
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, slug")
    .eq("id", product.business_id)
    .maybeSingle();

  const amount = product.price * quantity;

  const { error } = await supabase.from("orders").insert({
    business_id: product.business_id,
    customer_id: session.userId,
    product_id: product.id,
    product_name: product.name,
    quantity,
    unit_price: product.price,
    amount,
    currency: product.currency,
    payment_method: paymentMethod,
    status: "paid",
    customer_name: session.profile.full_name || session.email || "Customer",
  });

  if (error) return errorState(error.message);

  if (product.stock !== null) {
    await supabase
      .from("products")
      .update({ stock: Math.max(0, product.stock - quantity) })
      .eq("id", product.id);
  }

  revalidatePath("/dashboard/shopfront");
  if (business?.slug) revalidatePath(`/b/${business.slug}`);

  return successState(
    paymentMethod === "scan"
      ? "Payment received via QR — your order is confirmed. (Demo: no real charge.)"
      : "Payment received — your order is confirmed. (Demo: no real charge.)",
  );
}
