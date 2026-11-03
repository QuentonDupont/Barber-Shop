import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  BookOpenText,
  CalendarCheck,
  CalendarOff,
  Check,
  ChevronDown,
  Languages,
  Minus,
  Receipt,
  Scissors,
  ShieldCheck,
  ShieldHalf,
  Tag,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/landing/reveal";
import { BETA_INVITE_HREF } from "@/lib/beta";
import { PAID_PLANS_ON_SALE, PLANS } from "@/lib/about";
import { formatMoney } from "@/lib/booking/time";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import { PRIVACY_POLICY_ROUTE } from "@/lib/privacy/policy";
import { cn } from "@/lib/utils";

const PAD = "mx-auto max-w-[1120px] px-[clamp(16px,3vw,40px)]";
const H2 =
  "display text-[clamp(1.75rem,1.1rem+2.4vw,3rem)] [&:lang(en)]:leading-[1.08] [&:lang(th)]:leading-[1.25]";

function Pair({ icon: Icon, title, body, soon }: { icon: LucideIcon; title: string; body: string; soon?: string }) {
  return (
    <Card className="flex h-full gap-4 p-4 text-fg sm:p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <h3 className="text-[17px] font-semibold leading-snug [&:lang(th)]:leading-[1.5]">
          {title}
          {soon ? (
            <Badge tone="neutral" className="ml-2 align-middle">
              {soon}
            </Badge>
          ) : null}
        </h3>
        <p className="mt-1 text-[15px] text-fg-muted text-pretty [&:lang(th)]:leading-[1.65]">{body}</p>
      </div>
    </Card>
  );
}

function StepCard({ n, label, title, body }: { n: number; label: string; title: string; body: string }) {
  return (
    <li className="list-none">
      <Card className="relative h-full overflow-hidden border-dashed p-4 text-fg sm:p-5">
        <p
          aria-hidden
          className="num flex size-11 items-center justify-center rounded-full bg-accent text-xl font-bold text-accent-fg"
        >
          {n}
        </p>
        <h3 className="mt-3 text-[17px] font-semibold [&:lang(th)]:leading-[1.5]">
          <span className="sr-only">{label}: </span>
          {title}
        </h3>
        <p className="mt-1 text-[15px] text-fg-muted text-pretty [&:lang(th)]:leading-[1.65]">{body}</p>
      </Card>
    </li>
  );
}

export function AboutHero({ locale }: { locale: Locale }) {
  const a = (k: string) => t(locale, `about.${k}`);
  return (
    <section aria-labelledby="about-title" className="pb-12 pt-4 lg:pb-20">
      <div className={PAD}>
        <div className="rounded-[var(--radius-panel)] border-2 border-accent bg-surface p-6 text-fg sm:p-10 lg:p-14">
          <Badge tone="accent" className="mb-5 whitespace-normal">
            {a("heroBadge")}
          </Badge>
          <h1
            id="about-title"
            className="display max-w-[20ch] text-[clamp(2.25rem,1.4rem+3.6vw,4.25rem)] [&:lang(en)]:leading-[1.05] [&:lang(th)]:leading-[1.25]"
          >
            {a("heroTitle")}
          </h1>
          <p className="mt-5 max-w-[56ch] text-pretty text-lg text-fg-muted [&:lang(en)]:leading-[1.55] [&:lang(th)]:leading-[1.75]">
            {a("heroBody")}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" variant="accent" className="w-full sm:w-auto">
              <a href={BETA_INVITE_HREF}>{a("heroPrimary")}</a>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <a href="#customers">{a("heroSecondary")}</a>
            </Button>
          </div>
          <p className="mt-5 text-sm font-medium text-fg-muted">{a("freeStart")}</p>
        </div>
      </div>
    </section>
  );
}

export function AboutCustomers({ locale }: { locale: Locale }) {
  const a = (k: string, vars?: Record<string, string | number>) => t(locale, `about.${k}`, vars);
  const steps = [1, 2, 3].map((n) => ({ n, title: a(`cStep${n}Title`), body: a(`cStep${n}Body`) }));
  const benefits: [LucideIcon, string][] = [
    [CalendarCheck, "cBenefit1"],
    [Scissors, "cBenefit2"],
    [Tag, "cBenefit3"],
    [ShieldCheck, "cBenefit4"],
  ];
  return (
    <section id="customers" aria-labelledby="customers-title" className="scroll-mt-4 py-12 lg:py-20">
      <Reveal className={PAD}>
        <Badge tone="accent" className="rv mb-4 text-sm">
          {a("customersFreeBadge")}
        </Badge>
        <h2 id="customers-title" className={cn(H2, "rv max-w-[22ch]")}>
          {a("customersTitle")}
        </h2>
        <p className="rv mt-3 max-w-[56ch] text-pretty text-lg text-fg-muted [&:lang(th)]:leading-[1.7]">
          {a("customersFreeLine")}
        </p>
        <ol className="rv mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <StepCard key={s.n} n={s.n} label={a("step", { n: s.n })} title={s.title} body={s.body} />
          ))}
        </ol>
        <ul className="rv mt-4 grid gap-4 sm:grid-cols-2">
          {benefits.map(([Icon, key]) => (
            <li key={key} className="list-none">
              <Pair icon={Icon} title={a(`${key}Title`)} body={a(`${key}Body`)} />
            </li>
          ))}
        </ul>
        <div className="rv mt-8">
          <Button asChild size="lg" variant="primary" className="w-full sm:w-auto">
            <Link href="/app">
              {a("customersCta")}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </Reveal>
    </section>
  );
}

export function AboutOwners({ locale }: { locale: Locale }) {
  const a = (k: string) => t(locale, `about.${k}`);
  const steps = [1, 2, 3, 4].map((n) => ({ n, title: a(`oStep${n}Title`), body: a(`oStep${n}Body`) }));
  const features: [LucideIcon, string, boolean?][] = [
    [CalendarCheck, "f1"],
    [Users, "f2"],
    [Scissors, "f3"],
    [CalendarOff, "f4"],
    [ShieldCheck, "f5"],
    [BookOpenText, "f6"],
    [BadgePercent, "f7"],
    [Wallet, "f8"],
    [Languages, "f9"],
    [Receipt, "f10", true],
  ];
  return (
    <section
      id="owners"
      aria-labelledby="owners-title"
      className="scroll-mt-4 bg-field-ink py-14 text-field-ink-fg lg:py-24"
    >
      <Reveal className={PAD}>
        <h2 id="owners-title" className={cn(H2, "rv max-w-[22ch]")}>
          {a("ownersTitle")}
        </h2>
        <p className="rv mt-3 max-w-[56ch] text-pretty text-lg text-field-ink-muted [&:lang(th)]:leading-[1.7]">
          {a("ownersLead")}
        </p>
        <ol className="rv mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <StepCard key={s.n} n={s.n} label={`${s.n}`} title={s.title} body={s.body} />
          ))}
        </ol>
        <h3 className="rv mt-12 text-xl font-semibold">{a("featuresTitle")}</h3>
        <ul className="rv mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(([Icon, key, soon]) => (
            <li key={key} className="list-none">
              <Pair icon={Icon} title={a(`${key}Title`)} body={a(`${key}Body`)} soon={soon ? a("soon") : undefined} />
            </li>
          ))}
        </ul>
        <div className="rv mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <Button asChild size="lg" variant="accent" className="w-full sm:w-auto">
            <a href={BETA_INVITE_HREF}>{a("ownersCta")}</a>
          </Button>
          <p className="text-[15px] text-field-ink-muted">{a("ownersCtaNote")}</p>
        </div>
      </Reveal>
    </section>
  );
}

function Mark({ yes, locale }: { yes: boolean; locale: Locale }) {
  return yes ? (
    <>
      <Check className="mx-auto size-5 text-accent-ink" aria-hidden />
      <span className="sr-only">{t(locale, "about.included")}</span>
    </>
  ) : (
    <>
      <Minus className="mx-auto size-5 text-fg-subtle" aria-hidden />
      <span className="sr-only">{t(locale, "about.notIncluded")}</span>
    </>
  );
}

export function AboutPlans({ locale }: { locale: Locale }) {
  const a = (k: string) => t(locale, `about.${k}`);
  const planName = (id: string) => a(id === "free" ? "planFree" : id === "pro" ? "planPro" : "planStudio");
  const barbers = ["barbersFree", "barbersPro", "barbersStudio"];
  const rows: { label: string; cells: React.ReactNode[] }[] = [
    {
      label: a("rowPrice"),
      cells: PLANS.map((p) => (
        <span key={p.id} className="num block text-lg font-bold">
          {formatMoney(p.pricePerMonth)}
          <span className="block text-xs font-medium text-fg-muted">{a("perMonth")}</span>
        </span>
      )),
    },
    { label: a("rowBarbers"), cells: barbers.map((k) => <span key={k} className="font-semibold">{a(k)}</span>) },
    { label: a("rowBookings"), cells: PLANS.map((p) => <span key={p.id} className="font-semibold">{a("unlimited")}</span>) },
    { label: a("rowCommission"), cells: PLANS.map((p) => <span key={p.id} className="font-semibold">{a("none")}</span>) },
    ...(["rowPage", "rowCalendar", "rowServices", "rowPolicy", "rowEmail"] as const).map((k) => ({
      label: a(k),
      cells: PLANS.map((p) => <Mark key={p.id} yes locale={locale} />),
    })),
    { label: a("rowNotes"), cells: PLANS.map((p) => <Mark key={p.id} yes={p.id !== "free"} locale={locale} />) },
    { label: a("rowSupport"), cells: PLANS.map((p) => <Mark key={p.id} yes={p.id === "studio"} locale={locale} />) },
  ];
  return (
    <section id="plans" aria-labelledby="plans-title" className="scroll-mt-4 py-14 lg:py-24">
      <Reveal className={PAD}>
        <h2 id="plans-title" className={cn(H2, "rv max-w-[22ch]")}>
          {a("plansTitle")}
        </h2>
        <p className="rv mt-3 text-lg text-fg-muted [&:lang(th)]:leading-[1.7]">{a("plansLead")}</p>
        <div
          role="region"
          tabIndex={0}
          aria-label={a("plansTableLabel")}
          className="rv mt-8 overflow-x-auto rounded-[var(--radius-panel)] border border-border bg-surface text-fg focus-visible:outline-2 focus-visible:outline-ring"
        >
          <table className="w-full min-w-[520px] border-collapse text-center text-[15px]">
            <caption className="sr-only">{a("plansTableLabel")}</caption>
            <thead>
              <tr className="border-b border-border">
                <td className="sticky left-0 w-[34%] bg-surface p-3" />
                {PLANS.map((p) => (
                  <th
                    key={p.id}
                    scope="col"
                    className={cn("p-3 text-base font-bold", p.id === "free" ? "text-fg" : "bg-accent text-accent-fg")}
                  >
                    {planName(p.id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <th
                    scope="row"
                    className="sticky left-0 bg-surface p-3 text-left font-medium [&:lang(th)]:leading-[1.5]"
                  >
                    {row.label}
                  </th>
                  {row.cells.map((cell, i) => (
                    <td key={i} className="p-3 align-middle">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          role="note"
          className="rv mt-4 rounded-[var(--radius-field)] bg-accent-soft p-4 text-[15px] font-medium text-accent-ink [&:lang(th)]:leading-[1.65]"
        >
          {a("plansNotice")}
        </div>
        <p className="rv mt-4 max-w-[64ch] text-[15px] text-fg-muted text-pretty [&:lang(th)]:leading-[1.7]">
          {a("foundingOffer")}
        </p>
        <p className="rv mt-2 text-[15px] font-semibold">{a("neverCut")}</p>
        <div className="rv mt-6 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" variant="accent" className="w-full sm:w-auto">
            <a href={BETA_INVITE_HREF}>{a("planFreeCta")}</a>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={!PAID_PLANS_ON_SALE}
            aria-disabled={!PAID_PLANS_ON_SALE}
          >
            {a("planPaidCta")}
          </Button>
        </div>
      </Reveal>
    </section>
  );
}

export function AboutFaq({ locale }: { locale: Locale }) {
  const a = (k: string) => t(locale, `about.${k}`);
  const items = Array.from({ length: 9 }, (_, i) => ({ q: a(`q${i + 1}`), a: a(`a${i + 1}`) }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-4 pb-14 lg:pb-24">
      <div className={cn(PAD, "max-w-[820px]")}>
        <h2 id="faq-title" className={H2}>
          {a("faqTitle")}
        </h2>
        <div className="mt-8 space-y-3">
          {items.map((item, i) => (
            <details
              key={item.q}
              open={i === 0}
              className="group rounded-[var(--radius-field)] border border-border bg-surface text-fg"
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-4 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                <span className="[&:lang(th)]:leading-[1.5]">{item.q}</span>
                <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="px-4 pb-4 text-[15px] text-fg-muted text-pretty [&:lang(th)]:leading-[1.7]">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6">
          <Link
            href={PRIVACY_POLICY_ROUTE}
            className="inline-flex min-h-11 items-center gap-2 font-semibold text-accent-ink underline underline-offset-4"
          >
            <ShieldHalf className="size-4" aria-hidden />
            {a("privacyLink")}
          </Link>
        </p>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </div>
    </section>
  );
}

export function AboutClosing({ locale }: { locale: Locale }) {
  return (
    <section aria-labelledby="about-close" className="bg-field-brass py-14 text-field-brass-ink lg:py-20">
      <div className={cn(PAD, "flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between")}>
        <h2 id="about-close" className={cn(H2, "max-w-[20ch]")}>
          {t(locale, "about.closeLine")}
        </h2>
        <Button asChild size="lg" variant="primary" className="w-full sm:w-auto">
          <a href={BETA_INVITE_HREF}>{t(locale, "about.closeButton")}</a>
        </Button>
      </div>
    </section>
  );
}
