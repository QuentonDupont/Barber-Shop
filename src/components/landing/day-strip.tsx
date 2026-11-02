import { Reveal } from "@/components/landing/reveal";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * One real day at Nong Barber (the demo fixtures) drawn as a bar from 10:00
 * to 20:00: booked blocks in ink, free gaps left as the track, and one brass
 * block for "your slot". Horizontal from `sm`, vertical on a phone so it never
 * scrolls sideways.
 */
const OPEN = 10 * 60;
const CLOSE = 20 * 60;
const SPAN = CLOSE - OPEN;

const BLOCKS: { start: number; end: number; label: string; yours?: boolean }[] = [
  { start: 10 * 60 + 15, end: 10 * 60 + 45, label: "Hot-towel shave" },
  { start: 12 * 60, end: 12 * 60 + 45, label: "", yours: true },
  { start: 14 * 60 + 30, end: 16 * 60, label: "Cut & beard" },
  { start: 17 * 60, end: 17 * 60 + 45, label: "Men's cut" },
];

const HOURS = [10, 12, 14, 16, 18, 20];

const pct = (minute: number) => `${((minute - OPEN) / SPAN) * 100}%`;
const size = (start: number, end: number) => `${((end - start) / SPAN) * 100}%`;

export function DayStrip({ locale }: { locale: Locale }) {
  const yours = t(locale, "landing.stripYours");

  return (
    <section aria-labelledby="strip-title" className="bg-bg">
      <Reveal className="mx-auto grid max-w-[1360px] gap-10 px-[clamp(16px,3vw,40px)] py-[88px] lg:grid-cols-12 lg:gap-10 lg:py-40">
        <div className="lg:col-span-4">
          <h2
            id="strip-title"
            className="display rv text-[clamp(2rem,1.2rem+2.8vw,3.75rem)] [&:lang(en)]:leading-[1.05] [&:lang(th)]:leading-[1.22]"
          >
            {t(locale, "landing.stripTitle")}
          </h2>
          <p
            className="rv mt-5 max-w-[62ch] text-pretty text-[17px] leading-[1.6] text-fg-muted [&:lang(th)]:leading-[1.7]"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            {t(locale, "landing.stripBody")}
          </p>
        </div>

        <figure className="rv lg:col-span-8 lg:self-end" style={{ "--i": 2 } as React.CSSProperties}>
          {/* Horizontal, sm and up. Labels sit above the track so short
              blocks never truncate to "Men'…". */}
          <div aria-hidden className="hidden sm:block">
            <div className="relative mb-2 h-5">
              {BLOCKS.map((block) => (
                <span
                  key={block.start}
                  className={cn(
                    "absolute top-0 max-w-[18%] truncate text-[13px] font-semibold",
                    block.yours ? "text-accent-ink" : "text-fg",
                  )}
                  style={{ left: pct(block.start) }}
                >
                  {block.yours ? yours : block.label}
                </span>
              ))}
            </div>
            <div className="relative h-[72px] overflow-hidden rounded-[20px] bg-surface">
              {BLOCKS.map((block) => (
                <div
                  key={block.start}
                  className={cn(
                    "absolute inset-y-0",
                    block.yours ? "bg-accent" : "rv-wipe bg-fg",
                  )}
                  style={{ left: pct(block.start), width: size(block.start, block.end) }}
                />
              ))}
            </div>
            <div className="relative mt-2 h-5">
              {HOURS.map((hour, i) => (
                <span
                  key={hour}
                  className={cn(
                    "num absolute top-0 text-[13px] text-fg-muted",
                    i === 0 ? "" : i === HOURS.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
                  )}
                  style={{ left: pct(hour * 60) }}
                >
                  {hour}:00
                </span>
              ))}
            </div>
          </div>

          {/* Vertical, phone */}
          <div aria-hidden className="flex gap-3 sm:hidden">
            <div className="relative w-11 shrink-0" style={{ height: 400 }}>
              {HOURS.map((hour, i) => (
                <span
                  key={hour}
                  className={cn(
                    "num absolute right-0 text-[13px] text-fg-muted",
                    i === 0 ? "" : i === HOURS.length - 1 ? "-translate-y-full" : "-translate-y-1/2",
                  )}
                  style={{ top: pct(hour * 60) }}
                >
                  {hour}:00
                </span>
              ))}
            </div>
            <div className="relative w-16 shrink-0 overflow-hidden rounded-[20px] bg-surface" style={{ height: 400 }}>
              {BLOCKS.map((block) => (
                <div
                  key={block.start}
                  className={cn(
                    "absolute inset-x-0",
                    block.yours ? "bg-accent" : "rv-wipe bg-fg",
                  )}
                  style={{ top: pct(block.start), height: size(block.start, block.end) }}
                />
              ))}
            </div>
            <div className="relative min-w-0 flex-1" style={{ height: 400 }}>
              {BLOCKS.map((block) => (
                <span
                  key={block.start}
                  className={cn(
                    "absolute left-0 right-0 truncate text-[13px] font-semibold",
                    block.yours ? "text-accent-ink" : "text-fg",
                  )}
                  style={{ top: pct(block.start) }}
                >
                  {block.yours ? yours : block.label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-fg-muted">
            <span className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-full bg-fg" />
              {t(locale, "landing.stripBooked")}
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-full bg-surface ring-1 ring-border-strong" />
              {t(locale, "landing.stripFree")}
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-full bg-accent" />
              {yours}
            </span>
          </div>
          <figcaption className="mt-2 text-sm text-fg-subtle">
            {t(locale, "landing.stripCaption")}
          </figcaption>
        </figure>
      </Reveal>
    </section>
  );
}
