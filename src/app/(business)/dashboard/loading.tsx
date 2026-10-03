import { Skeleton } from "@/components/ui/misc";

/** Mirrors the Today page: stat tiles above the day's agenda. */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-4 w-32 rounded" />
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[4.5rem] w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
