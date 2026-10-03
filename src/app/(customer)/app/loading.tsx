import { Skeleton } from "@/components/ui/misc";

/** Mirrors the discovery page's real shape: search, category chips, cards. */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading">
      <Skeleton className="h-11 w-full rounded-lg" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-20 shrink-0 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-4 w-24 rounded" />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[6.5rem] w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
