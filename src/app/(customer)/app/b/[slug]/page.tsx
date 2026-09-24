import { redirect } from "next/navigation";
import { businessPath } from "@/lib/routes";

/** The booking page moved to `/b/[slug]`; keep old links and bookmarks working. */
export default async function LegacyBusinessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const clean = Object.fromEntries(
    Object.entries(query).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  redirect(businessPath(slug, clean));
}
