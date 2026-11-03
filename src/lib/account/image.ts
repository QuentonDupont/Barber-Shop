/**
 * Profile-photo validation and metadata stripping (tatnat-accounts-billing,
 * customer stream; legal-review D, "photo risks" 1 and 2).
 *
 * Pure functions on bytes, no Node-only imports, so they are unit-tested
 * directly and shared by the upload route and the mock store.
 *
 * - The type is decided from the file's magic bytes, never from its name or the
 *   browser-reported MIME type.
 * - Anything that does not parse as a JPEG, PNG or WebP container is refused.
 * - Location and device data is removed WITHOUT re-encoding the pixels: JPEG
 *   APP1 (Exif, XMP), APP3-APP15 and comments; PNG eXIf/text/time chunks; WebP
 *   EXIF and XMP chunks. The picture itself is untouched.
 *
 * FOLLOW-UP (not done here, no npm package may be added): resize to a sane
 * maximum and re-encode on the server with `sharp`, which also normalises
 * orientation and drops colour-profile oddities. This stripper is the interim
 * control and is deliberately strict (rejects on any structural doubt).
 */

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export type ImageKind = "jpeg" | "png" | "webp";

export const IMAGE_MIME: Record<ImageKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
export const IMAGE_EXT: Record<ImageKind, string> = { jpeg: "jpg", png: "png", webp: "webp" };

export type ImageError = "empty" | "too_large" | "type" | "corrupt";

export type ImageResult =
  | { ok: true; kind: ImageKind; mime: string; ext: string; bytes: Uint8Array }
  | { ok: false; error: ImageError };

/** Which of the three allowed formats the bytes are, or null. */
export function detectImageKind(b: Uint8Array): ImageKind | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) return "png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "webp";
  return null;
}

function ascii(b: Uint8Array, from: number, to: number): string {
  let s = "";
  for (let i = from; i < to; i++) s += String.fromCharCode(b[i] ?? 0);
  return s;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** JPEG: copy every segment except Exif/XMP (E1), E3-EF and comments (FE). */
function stripJpeg(b: Uint8Array): Uint8Array | null {
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    while (b[i + 1] === 0xff) i++; // fill bytes
    const marker = b[i + 1];
    if (marker === undefined) return null;
    if (marker === 0xd9) { // EOI
      parts.push(b.subarray(i, i + 2));
      return concat(parts);
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { // no length
      parts.push(b.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > b.length) return null;
    const len = ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0);
    if (len < 2 || i + 2 + len > b.length) return null;
    if (marker === 0xda) { // SOS: entropy-coded data follows, copy the rest as is
      parts.push(b.subarray(i));
      return concat(parts);
    }
    const drop = marker === 0xe1 || (marker >= 0xe3 && marker <= 0xef) || marker === 0xfe;
    if (!drop) parts.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return null; // never reached the pixel data
}

/** PNG: copy every chunk except metadata chunks. Must start IHDR and end IEND. */
function stripPng(b: Uint8Array): Uint8Array | null {
  const DROP = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  let first = true;
  while (i + 12 <= b.length) {
    const len = ((b[i] ?? 0) * 2 ** 24) + (((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0));
    const type = ascii(b, i + 4, i + 8);
    const end = i + 12 + len;
    if (end > b.length) return null;
    if (first && type !== "IHDR") return null;
    first = false;
    if (!DROP.has(type)) parts.push(b.subarray(i, end));
    i = end;
    if (type === "IEND") return concat(parts);
  }
  return null;
}

/** WebP: copy every chunk except EXIF and XMP; fix VP8X flags and RIFF size. */
function stripWebp(b: Uint8Array): Uint8Array | null {
  const riffLen = (b[4] ?? 0) | ((b[5] ?? 0) << 8) | ((b[6] ?? 0) << 16) | ((b[7] ?? 0) * 2 ** 24);
  if (riffLen + 8 > b.length || riffLen < 4) return null;
  const limit = riffLen + 8;
  const chunks: Uint8Array[] = [];
  let i = 12;
  let sawImage = false;
  while (i + 8 <= limit) {
    const type = ascii(b, i, i + 4);
    const len = (b[i + 4] ?? 0) | ((b[i + 5] ?? 0) << 8) | ((b[i + 6] ?? 0) << 16) | ((b[i + 7] ?? 0) * 2 ** 24);
    const end = i + 8 + len + (len % 2);
    if (end > limit) return null;
    if (type === "VP8 " || type === "VP8L" || type === "ANMF") sawImage = true;
    if (type === "VP8X") {
      if (len < 10) return null;
      const copy = b.slice(i, end);
      copy[8] = (copy[8] ?? 0) & ~0x0c; // clear the EXIF (0x08) and XMP (0x04) flags
      chunks.push(copy);
    } else if (type !== "EXIF" && type !== "XMP ") {
      chunks.push(b.subarray(i, end));
    }
    i = end;
  }
  if (!sawImage) return null;
  const body = concat(chunks);
  const size = body.length + 4;
  const head = new Uint8Array(12);
  head.set(b.subarray(0, 4), 0);
  head[4] = size & 0xff;
  head[5] = (size >> 8) & 0xff;
  head[6] = (size >> 16) & 0xff;
  head[7] = (size >>> 24) & 0xff;
  head.set(b.subarray(8, 12), 8);
  return concat([head, body]);
}

/** Validate an upload and return the cleaned bytes, or the reason it was refused. */
export function prepareAvatar(input: Uint8Array): ImageResult {
  if (input.length === 0) return { ok: false, error: "empty" };
  if (input.length > AVATAR_MAX_BYTES) return { ok: false, error: "too_large" };
  const kind = detectImageKind(input);
  if (!kind) return { ok: false, error: "type" };
  const cleaned = kind === "jpeg" ? stripJpeg(input) : kind === "png" ? stripPng(input) : stripWebp(input);
  if (!cleaned) return { ok: false, error: "corrupt" };
  return { ok: true, kind, mime: IMAGE_MIME[kind], ext: IMAGE_EXT[kind], bytes: cleaned };
}
