import { cn } from "@/lib/utils";

export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-fg"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" strokeWidth="2.25">
          <path
            d="M7 3v3M17 3v3M3.5 9h17M5 6h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 5 6Z"
            stroke="currentColor"
            strokeLinecap="round"
          />
          <path
            d="m8.75 14.25 2 2 4-4.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {showWordmark ? (
        <span className="text-lg font-bold tracking-tight">Bookly</span>
      ) : null}
      <span className="sr-only">Bookly</span>
    </span>
  );
}
