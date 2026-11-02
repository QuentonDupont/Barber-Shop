import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Thai leading vowels (เ แ โ ใ ไ) are written before the consonant they
 * belong to, so on their own they are not a usable initial. */
const THAI_LEADING_VOWEL = /^[เ-ไ]$/;

/** Splits text into user-perceived characters (grapheme clusters), so a Thai
 * consonant keeps its tone mark and vowel ("จ๊" is one cluster, not two). */
export function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

/** First meaningful grapheme of a word, skipping a Thai leading vowel:
 * "เจ๊หน่อย" → "จ๊", "Nong" → "N". */
export function firstGrapheme(word: string): string {
  const g = graphemes(word.trim());
  const i = g.findIndex((c) => !THAI_LEADING_VOWEL.test(c) && c.trim() !== "");
  return i === -1 ? (g[0] ?? "") : g[i]!;
}

/** Two-letter monogram for avatar fallbacks. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    const g = graphemes(parts[0]!);
    const first = firstGrapheme(parts[0]!);
    const isThai = /[฀-๿]/.test(first);
    // A single Thai word reads as one consonant; a Latin one as two letters.
    return (isThai ? first : g.slice(0, 2).join("")).toUpperCase();
  }
  return (firstGrapheme(parts[0]!) + firstGrapheme(parts.at(-1)!)).toUpperCase();
}
