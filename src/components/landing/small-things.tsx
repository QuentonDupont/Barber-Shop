import { Reveal } from "@/components/landing/reveal";
import { t, type Locale } from "@/lib/i18n/dictionaries";

export function SmallThings({ locale }: { locale: Locale }) {
  const rows = [
    { title: t(locale, "landing.r1Title"), body: t(locale, "landing.r1Body") },
    { title: t(locale, "landing.r2Title"), body: t(locale, "landing.r2Body") },
    { title: t(locale, "landing.r3Title"), body: t(locale, "landing.r3Body") },
  ];

  return (
    <section aria-labelledby="small-title" className="bg-bg">
      <Reveal className="mx-auto max-w-[1360px] px-[clamp(16px,3vw,40px)] py-[88px] lg:py-40">
        <h2
          id="small-title"
          className="display rv max-w-[22ch] text-[clamp(2rem,1.2rem+2.8vw,3.75rem)] [&:lang(en)]:leading-[1.05] [&:lang(th)]:leading-[1.22]"
        >
          {t(locale, "landing.smallTitle")}
        </h2>
        <div className="mt-12 space-y-10 lg:mt-16 lg:space-y-12">
          {rows.map((row, i) => (
            <div
              key={row.title}
              className="rv grid gap-2 lg:grid-cols-12 lg:gap-10"
              style={{ "--i": i + 1 } as React.CSSProperties}
            >
              <h3 className="text-xl font-semibold lg:col-span-4">{row.title}</h3>
              <p className="max-w-[62ch] text-pretty text-[17px] leading-[1.6] lg:col-span-6 [&:lang(th)]:leading-[1.7]">
                {row.body}
              </p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
