import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { isMockMode } from "@/lib/mock/config";
import { prepareAvatar, type ImageError } from "@/lib/account/image";

/**
 * Private photo storage for customer profile photos (customer account stream).
 *
 * Real mode: Supabase Storage, private bucket "avatars" (migration
 * 20261104000000_customer_account.sql), object path "<user id>/<file>". The
 * policies let only the owner of that folder read, write or delete. The page
 * never exposes the path: it asks for a short-lived signed URL.
 * Mock mode: the cleaned bytes become a data URL kept in the mock store
 * (profiles.avatar_url), so nothing leaves memory.
 *
 * Everything is validated and stripped by `prepareAvatar` first.
 */

const BUCKET = "avatars";
const SIGNED_URL_SECONDS = 60 * 60;

type Client = SupabaseClient<Database>;

export type StoreAvatarResult = { ok: true; ref: string } | { ok: false; error: ImageError | "storage" };

/** Store a new photo for `userId` and return the reference to keep in profiles.avatar_url. */
export async function storeAvatar(
  supabase: Client,
  userId: string,
  input: Uint8Array,
): Promise<StoreAvatarResult> {
  const prepared = prepareAvatar(input);
  if (!prepared.ok) return prepared;

  if (isMockMode()) {
    const b64 = Buffer.from(prepared.bytes).toString("base64");
    return { ok: true, ref: `data:${prepared.mime};base64,${b64}` };
  }

  const path = `${userId}/photo-${Date.now()}.${prepared.ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, prepared.bytes, {
    contentType: prepared.mime,
    upsert: false,
    cacheControl: "private, max-age=0",
  });
  if (error) return { ok: false, error: "storage" };
  return { ok: true, ref: path };
}

/** Delete a stored photo. Mock photos live in the profile row, so nothing to do. */
export async function deleteAvatar(supabase: Client, userId: string, ref: string | null): Promise<void> {
  if (!ref || isMockMode() || ref.startsWith("data:")) return;
  if (!ref.startsWith(`${userId}/`)) return; // never delete outside the owner's folder
  await supabase.storage.from(BUCKET).remove([ref]);
}

/** A URL the browser can show for a stored reference, or null. */
export async function avatarDisplayUrl(supabase: Client, ref: string | null): Promise<string | null> {
  if (!ref) return null;
  if (ref.startsWith("data:")) return ref;
  if (isMockMode()) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(ref, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}
