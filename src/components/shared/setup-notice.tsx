import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shown when Supabase credentials are missing. Without this the first run of a
 * fresh clone fails with an SDK-level "Invalid URL", which tells a newcomer
 * nothing about what to do next.
 */
export function SetupNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm",
        className,
      )}
      role="status"
    >
      <p className="flex items-center gap-2 font-semibold text-warning">
        <TriangleAlert className="size-4 shrink-0" />
        Bookly is not connected to a database yet
      </p>
      <p className="mt-2 text-fg-muted text-pretty">
        Copy <code className="rounded bg-surface px-1 py-0.5">.env.example</code>{" "}
        to <code className="rounded bg-surface px-1 py-0.5">.env.local</code>, add
        your Supabase URL and anon key, then run{" "}
        <code className="rounded bg-surface px-1 py-0.5">supabase db push</code> to
        apply the migrations. Full steps are in the README.
      </p>
    </div>
  );
}
