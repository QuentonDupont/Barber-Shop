import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { ServiceWorker } from "@/components/shared/service-worker";
import { LocaleProvider } from "@/lib/i18n/context";
import { LocaleToggle } from "@/components/shared/locale-toggle";
import { getLocale } from "@/lib/i18n/server";
import { fontVariables } from "./fonts";
import "./globals.css";

// Type system (fonts are self-hosted, see ./fonts.ts): Anuphan carries every
// operated surface; Noto Sans Thai is the Thai-safe fallback; Mitr is the
// display face for public headings only (`.display` in globals.css).

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
    { media: "(prefers-color-scheme: light)", color: "#F2F2EF" },
    { media: "(prefers-color-scheme: dark)", color: "#151311" },
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
      className={fontVariables}
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
            __html: `document.documentElement.classList.add("js");(function(){try{var s=localStorage.getItem("tatnat-theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d){document.documentElement.classList.add("dark")}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-dvh antialiased">
        <LocaleProvider initialLocale={locale}>
          {/* In normal page flow (not fixed): it can never sit on top of a header
              button, and sheets/dialogs (z-50) always cover it. */}
          <div
            data-testid="locale-bar"
            className="relative z-10 flex justify-end px-3 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4"
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
