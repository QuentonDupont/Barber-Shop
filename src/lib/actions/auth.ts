"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { errorState, fieldErrorsFrom, type ActionState } from "./types";

const roleSchema = z.enum(["customer", "business_owner"]);

const signUpSchema = z.object({
  role: roleSchema,
  fullName: z.string().trim().min(2, "Please tell us your name"),
  email: z.email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .min(6, "Enter a phone number we can reach you on")
    .max(24, "That phone number looks too long"),
  password: z.string().min(8, "Use at least 8 characters"),
});

const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

function safeNext(next: FormDataEntryValue | null, fallback: string): string {
  const value = typeof next === "string" ? next : "";
  // Only ever redirect to a path on this origin.
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function homeFor(role: z.infer<typeof roleSchema>): string {
  return role === "business_owner" ? "/dashboard" : "/app";
}

export async function signUpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    role: formData.get("role"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return errorState(
      "Please check the highlighted fields.",
      fieldErrorsFrom(z.flattenError(parsed.error).fieldErrors),
    );
  }

  const { role, fullName, email, phone, password } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the `handle_new_user` trigger to create the profile row.
      data: { role, full_name: fullName, phone },
    },
  });

  if (error) {
    return errorState(
      error.message.toLowerCase().includes("already registered")
        ? "That email already has an account. Try signing in instead."
        : error.message,
    );
  }

  // A customer who signed up from a shop's booking page goes straight back
  // to it. Owners always start at onboarding.
  redirect(role === "customer" ? safeNext(formData.get("next"), homeFor(role)) : homeFor(role));
}

export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return errorState(
      "Please check the highlighted fields.",
      fieldErrorsFrom(z.flattenError(parsed.error).fieldErrors),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Deliberately vague: do not confirm whether an address has an account.
    return errorState("That email and password do not match an account.");
  }

  const role =
    (data.user.user_metadata?.role as z.infer<typeof roleSchema> | undefined) ??
    "customer";

  redirect(safeNext(formData.get("next"), homeFor(role)));
}

export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  const role = roleSchema.catch("customer").parse(formData.get("role"));
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?role=${role}&next=${encodeURIComponent(
        homeFor(role),
      )}`,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error || !data.url) {
    redirect(`/sign-in?error=${encodeURIComponent(error?.message ?? "Google sign-in failed")}`);
  }

  redirect(data.url);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
