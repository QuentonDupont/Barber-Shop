import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteAvatar, storeAvatar } from "@/lib/storage";
import { AVATAR_MAX_BYTES } from "@/lib/account/image";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

/**
 * Customer profile photo: POST (multipart "file") replaces it, DELETE removes it.
 * A route handler rather than a Server Action because actions cap the body at 1 MB.
 * Only the signed-in customer's own photo can be touched.
 */

const ERROR_KEY = {
  empty: "photoErrEmpty",
  too_large: "photoErrSize",
  type: "photoErrType",
  corrupt: "photoErrCorrupt",
  storage: "photoErrFailed",
} as const;

async function customer() {
  const session = await getSession();
  return session && session.profile.role === "customer" ? session : null;
}

export async function POST(request: Request) {
  const locale = await getLocale();
  const session = await customer();
  if (!session) return NextResponse.json({ ok: false, message: "Not signed in" }, { status: 401 });

  // Refuse early on an obviously oversize body, without reading it all.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > AVATAR_MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ ok: false, message: t(locale, "accountCustomer.photoErrSize") }, { status: 413 });
  }

  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return NextResponse.json({ ok: false, message: t(locale, "accountCustomer.photoErrFailed") }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: t(locale, "accountCustomer.photoErrEmpty") }, { status: 400 });
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return NextResponse.json({ ok: false, message: t(locale, "accountCustomer.photoErrSize") }, { status: 413 });
  }

  const supabase = await createClient();
  const stored = await storeAvatar(supabase, session.userId, new Uint8Array(await file.arrayBuffer()));
  if (!stored.ok) {
    return NextResponse.json(
      { ok: false, message: t(locale, `accountCustomer.${ERROR_KEY[stored.error]}`) },
      { status: stored.error === "storage" ? 500 : 400 },
    );
  }

  const { error } = await supabase.from("profiles").update({ avatar_url: stored.ref }).eq("id", session.userId);
  if (error) {
    await deleteAvatar(supabase, session.userId, stored.ref);
    return NextResponse.json({ ok: false, message: t(locale, "accountCustomer.photoErrFailed") }, { status: 500 });
  }
  await deleteAvatar(supabase, session.userId, session.profile.avatar_url);
  revalidatePath("/app/account");
  return NextResponse.json({ ok: true, message: t(locale, "accountCustomer.photoSaved") });
}

export async function DELETE() {
  const locale = await getLocale();
  const session = await customer();
  if (!session) return NextResponse.json({ ok: false, message: "Not signed in" }, { status: 401 });
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", session.userId);
  if (error) {
    return NextResponse.json({ ok: false, message: t(locale, "accountCustomer.photoErrFailed") }, { status: 500 });
  }
  await deleteAvatar(supabase, session.userId, session.profile.avatar_url);
  revalidatePath("/app/account");
  return NextResponse.json({ ok: true, message: t(locale, "accountCustomer.photoRemoved") });
}
