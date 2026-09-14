import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Clock3,
  MapPin,
  Scissors,
  Smartphone,
  Store,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { SetupNotice } from "@/components/shared/setup-notice";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function LandingPage() {
  const configured = isSupabaseConfigured();
  const session = configured ? await getSession().catch(() => null) : null;
  const signedInHome =
    session?.profile.role === "business_owner" ? "/dashboard" : "/app";

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/85 backdrop-blur-md pt-safe">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          {session ? (
            <Button asChild size="sm" variant="primary">
              <Link href={signedInHome}>
                Open Bookly
                <ArrowRight />
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="ghost">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        {!configured ? <SetupNotice className="mt-6" /> : null}

        {/* ---- Hero ------------------------------------------------------ */}
        <section className="pt-10 pb-4 sm:pt-16 sm:pb-8">
          <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent">
            <Clock3 className="size-3.5" />
            Real availability, not a callback request
          </p>
          <h1 className="mt-4 text-balance text-[2rem] font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Book your next appointment in{" "}
            <span className="text-accent">under a minute</span>.
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-fg-muted sm:text-lg">
            Bookly shows you the times a salon, barber, clinic or studio can
            genuinely see you — then holds the slot the moment you tap it. No
            phone calls, no waiting for a reply.
          </p>
        </section>

        {/* ---- The two doors --------------------------------------------
            The whole product forks here, so the choice gets the full width of
            a phone screen rather than being buried in a nav menu. ---------- */}
        <section aria-labelledby="choose-portal" className="mt-4 sm:mt-8">
          <h2 id="choose-portal" className="sr-only">
            Choose how you want to use Bookly
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
            <PortalCard
              href="/sign-up?role=customer"
              signInHref="/sign-in?role=customer"
              eyebrow="I'm a customer"
              title="Find a place and book it"
              description="Browse shops near you, pick a service, choose a time that is actually free."
              icon={Users}
              tone="accent"
              points={[
                { icon: MapPin, text: "Shops near you, sorted by distance" },
                { icon: CalendarCheck, text: "Live slots — never double-booked" },
                { icon: Smartphone, text: "Manage and cancel from your phone" },
              ]}
            />

            <PortalCard
              href="/sign-up?role=business_owner"
              signInHref="/sign-in?role=business_owner"
              eyebrow="I'm a business"
              title="Fill your calendar"
              description="Publish your opening hours once. Bookly turns them into bookable slots and keeps your day organised."
              icon={Store}
              tone="primary"
              points={[
                { icon: Clock3, text: "Opening hours, breaks and holidays" },
                { icon: Scissors, text: "Your services, durations and prices" },
                { icon: CalendarCheck, text: "Day and week calendar of bookings" },
              ]}
            />
          </div>
        </section>

        {/* ---- Reassurance ------------------------------------------------ */}
        <section className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-3">
          {[
            {
              title: "Built for the phone in your hand",
              body: "Every screen is designed at 360px first. Big targets, thumb-reach buttons, works one-handed on the bus.",
            },
            {
              title: "Install it, skip the app store",
              body: "Add Bookly to your home screen and it opens full-screen like a native app — no download, no updates.",
            },
            {
              title: "Your time zone, their time zone",
              body: "Times always show in the shop's local clock, so a booking made abroad still means 2pm on the day.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]"
            >
              <h3 className="font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted text-pretty">
                {item.body}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-8 pb-safe">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-sm text-fg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p>© {new Date().getFullYear()} Bookly</p>
        </div>
      </footer>
    </div>
  );
}

function PortalCard({
  href,
  signInHref,
  eyebrow,
  title,
  description,
  icon: Icon,
  tone,
  points,
}: {
  href: string;
  signInHref: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "accent" | "primary";
  points: { icon: React.ComponentType<{ className?: string }>; text: string }[];
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex items-center gap-3">
        <span
          className={
            tone === "accent"
              ? "flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent"
              : "flex size-11 items-center justify-center rounded-xl bg-primary text-primary-fg"
          }
        >
          <Icon className="size-5.5" />
        </span>
        <p className="text-sm font-semibold text-fg-muted">{eyebrow}</p>
      </div>

      <h3 className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted text-pretty">
        {description}
      </p>

      <ul className="mt-5 space-y-2.5">
        {points.map((point) => (
          <li key={point.text} className="flex items-start gap-2.5 text-sm">
            <point.icon className="mt-0.5 size-4 shrink-0 text-accent" />
            <span className="text-fg-muted">{point.text}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col gap-2 sm:mt-auto sm:pt-6">
        <Button asChild size="lg" block variant={tone === "accent" ? "accent" : "primary"}>
          <Link href={href}>
            Create an account
            <ArrowRight />
          </Link>
        </Button>
        <Button asChild size="md" block variant="ghost">
          <Link href={signInHref}>I already have one</Link>
        </Button>
      </div>
    </div>
  );
}
