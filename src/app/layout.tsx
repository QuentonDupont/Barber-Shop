import type { Metadata, Viewport } from "next";
import { Anuphan, Noto_Sans_Thai, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { ServiceWorker } from "@/components/shared/service-worker";
import { LocaleProvider } from "@/lib/i18n/context";
import { LocaleToggle } from "@/components/shared/locale-toggle";
import { getLocale } from "@/lib/i18n/server";
import "./globals.css";

// Thai-capable type system, look-and-feel.md §4.3. Anuphan is one bilingual
// Thai+Latin family (matching x-height/weight across scripts) rather than a
// Latin font bolted to a separate Thai font — it carries headings, the
// wordmark and body text. Noto Sans Thai is the Thai-safe second fallback so
// a slow font load never shows missing Thai glyphs; Plus Jakarta Sans (the
// old Latin-only brand font) stays loaded as a third fallback purely for the
// Latin glyphs, per the spec's explicit fallback stack.
// NOTE (Engineering, 21 Oct 2026): this sandbox has no outbound network
// access at all — even the pre-existing Plus Jakarta Sans fetch hangs here on
// `next build` (confirmed before this change). Anuphan/Noto Sans Thai could
// not be fetched or visually verified in this environment; the fallback
// stack below is real and will carry the UI in degraded form if the fonts
// fail to load anywhere. QA/Ops should confirm the webfonts actually load in
// an environment with internet access before sign-off.
const anuphan = Anuphan({
  subsets: ["thai", "latin"],
  // "variable" loads the full weight axis (100-700 per Next's current font
  // metadata for this family) so headings can still use 800-weight via CSS
  // `font-weight` — the variable font exposes more than Next's discrete
  // weight list offers as a static-subset option.
  weight: "variable",
  variable: "--font-anuphan",
  display: "swap",
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai"],
  weight: ["400", "700"],
  variable: "--font-noto-thai",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TatNat — book local, instantly",
    template: "%s · TatNat",
  },
  description:
    "Find salons, barbers, clinics and studios near you and book a real time slot in seconds. Free scheduling tools for the businesses behind them.",
  applicationName: "TatNat",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "TatNat",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "TatNat",
    title: "TatNat — book local, instantly",
    description:
      "Find salons, barbers, clinics and studios near you and book a real time slot in seconds.",
  },
  icons: {
    // Small sizes use icon-mark (the small-size-safe glyph, look-and-feel.md
    // §4.4); the full-detail icon.svg is the scalable fallback for anything
    // larger than 32px a browser asks for (tab zoom, bookmark bar, etc.).
    icon: [
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      {
        url: "/icons/favicon-16-dark.png",
        sizes: "16x16",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icons/favicon-32-dark.png",
        sizes: "32x32",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png" }],
  },
};

export const viewport: Viewport = {
  // `viewport-fit=cover` is what makes the safe-area utilities do anything on
  // a notched iPhone. `maximumScale` is deliberately absent: capping zoom
  // breaks accessibility for anyone who needs to pinch in.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Exact --bg hex per theme (look-and-feel.md §4.2), replacing the earlier
  // approximations — matches the page background so the browser chrome
  // doesn't seam against it.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FCFAF8" },
    { media: "(prefers-color-scheme: dark)", color: "#171412" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Read before first paint, same reason the theme script below runs inline:
  // Thai is the default locale (roadmap.md §1 row 3), and a flash of English
  // before hydration would be exactly the kind of regression GoWabi's users
  // complained about (ux-benchmark.md §1).
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${anuphan.variable} ${notoSansThai.variable} ${jakarta.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the theme before first paint. The class used to be set by a
            useEffect inside the signed-in shells, which meant every cold start
            flashed light, and public pages (/, /sign-in) were never themed at
            all — so tapping through from the landing page was a light-to-dark
            jolt. Kept in sync with the toggle in account-menu.tsx. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("bookly-theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d){document.documentElement.classList.add("dark")}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-dvh antialiased">
        <LocaleProvider initialLocale={locale}>
          {/* In normal page flow (not fixed): it can never sit on top of a header
              button, and sheets/dialogs (z-50) always cover it. */}
          <div
            data-testid="locale-bar"
            className="flex justify-end px-3 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4"
          >
            <LocaleToggle />
          </div>
          {children}
        </LocaleProvider>
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ className: "font-sans" }}
        />
        <ServiceWorker />
      </body>
    </html>
  );
}
