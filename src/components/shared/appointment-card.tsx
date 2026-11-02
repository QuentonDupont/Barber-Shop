"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { useT } from "@/lib/i18n/context";
import { businessPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * The บัตรนัด — the paper appointment card every Thai clinic, dentist and
 * salon hands out, with the date and time written in by hand.
 *
 * `demo` (landing): pick a shop, tap one of its real free times, and the time
 * writes itself into the card and gets stamped. The button then goes to the
 * shop's real booking page for that service and day.
 * `booked` (sign-in panel): a filled, stamped card. Static.
 */

export interface DemoShop {
  slug: string;
  name: string;
  serviceId: string | null;
  serviceName: string;
  /** Already formatted, e.g. "฿350". */
  price: string;
  dateKey: string;
  /** "today" or "tomorrow" — which word goes into "Free {day} at {shop}". */
  day: "today" | "tomorrow";
  /** Formatted in the shop's timezone and the viewer's language. */
  dateLabel: string;
  /** Slot start times, formatted in the shop's timezone (≤ 6). */
  times: string[];
}

type Props =
  | { mode: "demo"; shops: DemoShop[]; className?: string }
  | {
      mode: "booked";
      shopName: string;
      serviceName: string;
      dateLabel: string;
      time: string;
      stamp: string;
      className?: string;
    };

export function AppointmentCard(props: Props) {
  const t = useT();

  return (
    <div
      data-ui
      className={cn(
        "appt-card relative rounded-[var(--radius-panel)] bg-card-paper p-5 text-fg sm:p-6",
        props.className,
      )}
    >
      {props.mode === "demo" ? <DemoBody shops={props.shops} /> : <BookedBody {...props} t={t} />}
    </div>
  );
}

function CardTop({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        <Logo showWordmark={false} className="[&_img]:size-6" />
        <span className="text-sm font-semibold">{title}</span>
      </span>
      {children}
    </div>
  );
}

function Row({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end gap-3", className)}>
      <span className="w-14 shrink-0 pb-1 text-[13px] text-fg-muted">{label}</span>
      <span className="min-w-0 flex-1 border-b-2 border-dotted border-border-strong pb-1 text-[17px] font-semibold leading-snug">
        {children}
      </span>
    </div>
  );
}

function Stamp({ label, shown }: { label: string; shown: boolean }) {
  return (
    <span
      aria-hidden
      data-shown={shown}
      className="appt-stamp pointer-events-none absolute -top-3 right-0 flex size-[76px] items-center justify-center rounded-full border-[3px] border-accent text-center sm:size-[92px]"
    >
      <span className="display px-1.5 text-[14px] text-accent-ink sm:text-base" style={{ lineHeight: 1.15 }}>
        {label}
      </span>
    </span>
  );
}

function BookedBody({
  shopName,
  serviceName,
  dateLabel,
  time,
  stamp,
  t,
}: {
  shopName: string;
  serviceName: string;
  dateLabel: string;
  time: string;
  stamp: string;
  t: ReturnType<typeof useT>;
}) {
  return (
    <>
      <CardTop title={t("landing.cardTitle")} />
      <div className="mt-5 space-y-3">
        <Row label={t("landing.cardShop")}>{shopName}</Row>
        <Row label={t("landing.cardService")}>{serviceName}</Row>
        <Row label={t("landing.cardDate")}>{dateLabel}</Row>
        <div className="relative">
          <Row label={t("landing.cardTime")}>
            <span className="display num block text-[40px] text-accent-ink" style={{ lineHeight: 1.1, letterSpacing: 0 }}>
              {time}
            </span>
          </Row>
          <Stamp label={stamp} shown />
        </div>
      </div>
    </>
  );
}

function DemoBody({ shops }: { shops: DemoShop[] }) {
  const t = useT();
  const [shopIndex, setShopIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  // Toggled off then on around each pick so the "write in" transition replays
  // from the start (and stays interruptible — it is a transition, not a
  // keyframe animation).
  const [inked, setInked] = useState(false);
  const frame = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const shop = shops[shopIndex] ?? shops[0];
  if (!shop) return null;

  const pick = (time: string) => {
    setPicked(time);
    setInked(false);
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => setInked(true));
    });
  };

  const switchShop = (index: number) => {
    if (index === shopIndex) return;
    setShopIndex(index);
    setPicked(null);
    setInked(false);
  };

  const href =
    shop.serviceId != null
      ? businessPath(shop.slug, { service: shop.serviceId, date: shop.dateKey })
      : businessPath(shop.slug);
  const dayWord = t(shop.day === "today" ? "landing.cardToday" : "landing.cardTomorrow");

  return (
    <>
      <CardTop title={t("landing.cardTitle")}>
        {shops.length > 1 ? (
          <div
            role="group"
            aria-label={t("landing.cardShopSwitch")}
            className="flex min-w-0 gap-1 rounded-full bg-surface-muted p-1"
          >
            {shops.map((s, i) => (
              <button
                key={s.slug}
                type="button"
                aria-pressed={i === shopIndex}
                onClick={() => switchShop(i)}
                className={cn(
                  "appt-press min-h-11 min-w-0 truncate rounded-full px-3 text-[13px] font-semibold",
                  i === shopIndex ? "bg-primary text-primary-fg" : "text-fg-muted hover:text-fg",
                )}
              >
                {s.name.split(/\s+/)[0]}
              </button>
            ))}
          </div>
        ) : null}
      </CardTop>

      <div className="mt-5 space-y-3">
        <Row label={t("landing.cardShop")}>
          <span className="block truncate">{shop.name}</span>
        </Row>
        <Row label={t("landing.cardService")}>
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate">{shop.serviceName}</span>
            <span className="num shrink-0 text-[15px] font-medium text-fg-muted">{shop.price}</span>
          </span>
        </Row>
        <Row label={t("landing.cardDate")}>{shop.dateLabel}</Row>
        <div className="relative">
          <Row label={t("landing.cardTime")} className="min-h-[60px]">
            {picked ? (
              <span
                data-inked={inked}
                className="appt-time display num block text-[34px] text-accent-ink sm:text-[40px]"
                style={{ lineHeight: 1.1, letterSpacing: 0 }}
              >
                {picked}
              </span>
            ) : (
              <span className="block py-1.5 text-[15px] font-normal text-fg-muted">
                {t("landing.cardPickTime")}
              </span>
            )}
          </Row>
          <Stamp label={t("landing.cardStampPicked")} shown={inked && picked != null} />
        </div>
      </div>

      <p className="mt-6 text-sm text-fg-muted">
        {t("landing.cardFreeAt", { day: dayWord, shop: shop.name })}
      </p>
      {shop.times.length > 0 ? (
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {shop.times.map((time) => {
            const selected = picked === time;
            return (
              <button
                key={time}
                type="button"
                aria-pressed={selected}
                onClick={() => pick(time)}
                className={cn(
                  "appt-press num min-h-11 rounded-full border px-2 text-[15px] font-semibold",
                  selected
                    ? "border-accent bg-accent text-accent-fg"
                    : "border-border-strong bg-surface text-fg hover:border-fg/40",
                )}
              >
                {time}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-2.5 text-[15px]">{t("landing.cardNoSlots")}</p>
      )}

      <Link
        href={href}
        className={cn(
          "appt-press mt-5 flex min-h-12 w-full items-center justify-center rounded-full px-5 text-[15px] font-semibold",
          picked
            ? "bg-accent text-accent-fg hover:bg-accent/90"
            : "border border-border-strong bg-transparent text-fg-muted hover:text-fg",
        )}
      >
        {t("landing.cardBook")}
      </Link>
    </>
  );
}
