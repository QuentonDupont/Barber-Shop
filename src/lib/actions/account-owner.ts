"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/auth";
import { errorState, fieldErrorsFrom, successState, type ActionState } from "./types";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import { businessPath } from "@/lib/routes";
import { isValidBranchCode, isValidThaiTaxId, normalizeDigits } from "@/lib/business/legal";

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).optional().or(z.literal(""));

const accountSchema = (locale: Locale) => {
  const tooLong = t(locale, "accountOwner.tooLong");
  return z.object({
    fullName: z.string().trim().min(2, t(locale, "accountOwner.nameRequired")).max(80, tooLong),
    phone: z.string().trim().min(6, t(locale, "accountOwner.phoneRequired")).max(24, tooLong),
    shopName: z.string().trim().min(2, t(locale, "accountOwner.shopNameRequired")).max(80, tooLong),
    address: optionalText(300, tooLong),
    shopPhone: z.string().trim().min(6, t(locale, "accountOwner.phoneRequired")).max(24, tooLong),
    lineId: optionalText(60, tooLong),
    legalName: optionalText(160, tooLong),
    taxId: z
      .string()
      .transform(normalizeDigits)
      .refine((v) => v === "" || isValidThaiTaxId(v), t(locale, "accountOwner.taxIdInvalid")),
    branchCode: z
      .string()
      .transform(normalizeDigits)
      .refine((v) => v === "" || isValidBranchCode(v), t(locale, "accountOwner.branchInvalid")),
    taxAddress: optionalText(400, tooLong),
    vatRegistered: z.boolean(),
    clearTaxId: z.boolean(),
  });
};

/**
 * Saves the owner's personal details (profile), the public shop details (the
 * same four columns the Settings action writes) and the owner-only legal/tax
 * row in one go. Legal fields go to `business_legal` only, never `businesses`.
 */
export async function saveOwnerAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = await getLocale();
  const parsed = accountSchema(locale).safeParse({
    fullName: formData.get("fullName") ?? "",
    phone: formData.get("phone") ?? "",
    shopName: formData.get("shopName") ?? "",
    address: formData.get("address") ?? "",
    shopPhone: formData.get("shopPhone") ?? "",
    lineId: formData.get("lineId") ?? "",
    legalName: formData.get("legalName") ?? "",
    // A pasted-back masked value ("*********0121") means "unchanged", never a new number.
    taxId: String(formData.get("taxId") ?? "").includes("*") ? "" : formData.get("taxId") ?? "",
    branchCode: formData.get("branchCode") ?? "",
    taxAddress: formData.get("taxAddress") ?? "",
    vatRegistered: formData.get("vatRegistered") === "on",
    clearTaxId: formData.get("clearTaxId") === "on",
  });

  if (!parsed.success) {
    return errorState(
      t(locale, "msg.checkFields"),
      fieldErrorsFrom(z.flattenError(parsed.error).fieldErrors),
    );
  }

  const d = parsed.data;
  const ctx = await requireBusiness();
  const supabase = await createClient();

  const profile = await supabase
    .from("profiles")
    .update({ full_name: d.fullName, phone: d.phone })
    .eq("id", ctx.userId);
  if (profile.error) return errorState(profile.error.message);

  await supabase.auth.updateUser({ data: { full_name: d.fullName, phone: d.phone } });

  const business = await supabase
    .from("businesses")
    .update({
      name: d.shopName,
      address: d.address || null,
      phone: d.shopPhone,
      line_id: d.lineId || null,
    })
    .eq("id", ctx.business.id);
  if (business.error) return errorState(business.error.message);

  const legal = await supabase.from("business_legal").upsert(
    {
      business_id: ctx.business.id,
      legal_name: d.legalName || null,
      // Blank means "keep what is saved" (the form only ever shows the last 4 digits);
      // clearing is its own explicit tick box.
      ...(d.taxId ? { tax_id: d.taxId } : d.clearTaxId ? { tax_id: null } : {}),
      branch_code: d.branchCode || "00000",
      tax_address: d.taxAddress || null,
      vat_registered: d.vatRegistered,
    },
    { onConflict: "business_id" },
  );
  if (legal.error) return errorState(legal.error.message);

  revalidatePath("/dashboard", "layout");
  revalidatePath(businessPath(ctx.business.slug));
  return successState(t(locale, "accountOwner.saved"));
}
