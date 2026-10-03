import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { ServiceWorker } from "@/components/shared/service-worker";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Bookly — book local, instantly",
    template: "%s · Bookly",
  },
  description:
    "Find salons, barbers, clinics and studios near you and book a real time slot in seconds. Free scheduling tools for the businesses behind them.",
  applicationName: "Bookly",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Bookly",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "Bookly",
    title: "Bookly — book local, instantly",
    description:
      "Find salons, barbers, clinics and studios near you and book a real time slot in seconds.",
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#16130f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={jakarta.variable} suppressHydrationWarning>
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
        {children}
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
