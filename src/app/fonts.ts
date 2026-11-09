import localFont from "next/font/local";

// Self-hosted webfonts (no request to Google Fonts at build or run time).
// Files and licence: src/app/fonts/ (SIL Open Font License, see OFL.txt).
//
// next/font/local has no unicode-range, so each family is loaded as one
// instance per script (Latin, Thai). globals.css lists the Latin instance
// first and the Thai one next, and the browser picks per glyph. Same faces,
// weights, CSS variables and display: swap as the old next/font/google setup.
// Anuphan's variable axis tops out at 700.

export const anuphanLatin = localFont({
  src: [{ path: "./fonts/anuphan-latin-wght-normal.woff2", weight: "100 700", style: "normal" }],
  variable: "--font-anuphan-latin",
  display: "swap",
});

export const anuphanThai = localFont({
  src: [{ path: "./fonts/anuphan-thai-wght-normal.woff2", weight: "100 700", style: "normal" }],
  variable: "--font-anuphan-thai",
  display: "swap",
});

export const mitrLatin = localFont({
  src: [
    { path: "./fonts/mitr-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/mitr-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-mitr-latin",
  display: "swap",
});

export const mitrThai = localFont({
  src: [
    { path: "./fonts/mitr-thai-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/mitr-thai-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-mitr-thai",
  display: "swap",
});

export const notoSansThai = localFont({
  src: [
    { path: "./fonts/noto-sans-thai-thai-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/noto-sans-thai-thai-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-noto-thai",
  display: "swap",
});

export const fontVariables = [
  anuphanLatin.variable,
  anuphanThai.variable,
  mitrLatin.variable,
  mitrThai.variable,
  notoSansThai.variable,
].join(" ");
