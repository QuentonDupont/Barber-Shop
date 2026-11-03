import { describe, expect, it } from "vitest";
import { AVATAR_MAX_BYTES, detectImageKind, prepareAvatar } from "./image";
import { validateEmailChange } from "./email";
import { DEFAULT_PREFS, MARKETING_CONSENT_VERSION, applyMarketingChoice } from "./prefs";

const enc = (s: string) => new TextEncoder().encode(s);
const cat = (...p: Uint8Array[]) => {
  const out = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of p) { out.set(x, o); o += x.length; }
  return out;
};
const has = (b: Uint8Array, needle: string) => Buffer.from(b).includes(Buffer.from(needle));

function jpegSegment(marker: number, payload: Uint8Array) {
  const len = payload.length + 2;
  return cat(new Uint8Array([0xff, marker, len >> 8, len & 0xff]), payload);
}
function jpeg(withExif: boolean) {
  return cat(
    new Uint8Array([0xff, 0xd8]),
    jpegSegment(0xe0, enc("JFIF\0\x01\x01\0\0\x01\0\x01\0\0")),
    withExif ? jpegSegment(0xe1, enc("Exif\0\0GPSLatitude=13.7")) : new Uint8Array(),
    withExif ? jpegSegment(0xfe, enc("made on Ann's phone")) : new Uint8Array(),
    jpegSegment(0xda, new Uint8Array([1, 1, 0, 0, 63, 0])),
    new Uint8Array([0x12, 0x34, 0xff, 0xd9]),
  );
}
const be32 = (n: number) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const le32 = (n: number) => new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]);
function pngChunk(type: string, data: Uint8Array) {
  return cat(be32(data.length), enc(type), data, new Uint8Array(4));
}
function png(withMeta: boolean) {
  return cat(
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", new Uint8Array(13)),
    withMeta ? pngChunk("eXIf", enc("GPSLatitude")) : new Uint8Array(),
    withMeta ? pngChunk("tEXt", enc("Comment\0secret")) : new Uint8Array(),
    pngChunk("IDAT", new Uint8Array([1, 2, 3])),
    pngChunk("IEND", new Uint8Array()),
  );
}
function webpChunk(type: string, data: Uint8Array) {
  return cat(enc(type), le32(data.length), data, data.length % 2 ? new Uint8Array(1) : new Uint8Array());
}
function webp(withMeta: boolean) {
  const vp8x = new Uint8Array(10);
  vp8x[0] = withMeta ? 0x08 | 0x04 : 0;
  const body = cat(
    enc("WEBP"),
    webpChunk("VP8X", vp8x),
    webpChunk("VP8 ", new Uint8Array([1, 2, 3])),
    withMeta ? webpChunk("EXIF", enc("GPSLatitude")) : new Uint8Array(),
    withMeta ? webpChunk("XMP ", enc("<x:xmpmeta/>")) : new Uint8Array(),
  );
  return cat(enc("RIFF"), le32(body.length), body);
}

describe("prepareAvatar", () => {
  it("accepts jpg, png and webp and strips location/device data", () => {
    const j = prepareAvatar(jpeg(true));
    expect(j).toMatchObject({ ok: true, kind: "jpeg", mime: "image/jpeg", ext: "jpg" });
    if (j.ok) {
      expect(has(j.bytes, "GPSLatitude")).toBe(false);
      expect(has(j.bytes, "Ann's phone")).toBe(false);
      expect(has(j.bytes, "JFIF")).toBe(true);
      expect(j.bytes[j.bytes.length - 1]).toBe(0xd9);
    }
    const p = prepareAvatar(png(true));
    expect(p).toMatchObject({ ok: true, kind: "png" });
    if (p.ok) {
      expect(has(p.bytes, "GPSLatitude")).toBe(false);
      expect(has(p.bytes, "secret")).toBe(false);
      expect(has(p.bytes, "IDAT")).toBe(true);
    }
    const w = prepareAvatar(webp(true));
    expect(w).toMatchObject({ ok: true, kind: "webp" });
    if (w.ok) {
      expect(has(w.bytes, "GPSLatitude")).toBe(false);
      expect(has(w.bytes, "XMP ")).toBe(false);
      expect(w.bytes[20]).toBe(0); // VP8X flags cleared
      const riff = (w.bytes[4] ?? 0) | ((w.bytes[5] ?? 0) << 8) | ((w.bytes[6] ?? 0) << 16);
      expect(riff + 8).toBe(w.bytes.length);
    }
  });

  it("leaves a clean file's pixels alone", () => {
    const clean = jpeg(false);
    const r = prepareAvatar(clean);
    expect(r.ok && Buffer.from(r.bytes).equals(Buffer.from(clean))).toBe(true);
  });

  it("decides the type from the bytes, not the name", () => {
    expect(detectImageKind(png(false))).toBe("png");
    expect(prepareAvatar(enc("<svg onload=alert(1)></svg>"))).toEqual({ ok: false, error: "type" });
    expect(prepareAvatar(enc("GIF89a....."))).toEqual({ ok: false, error: "type" });
    expect(prepareAvatar(enc("%PDF-1.7 hello"))).toEqual({ ok: false, error: "type" });
  });

  it("refuses empty, oversize and truncated files", () => {
    expect(prepareAvatar(new Uint8Array())).toEqual({ ok: false, error: "empty" });
    const big = new Uint8Array(AVATAR_MAX_BYTES + 1);
    big.set(png(false));
    expect(prepareAvatar(big)).toEqual({ ok: false, error: "too_large" });
    const exactly = new Uint8Array(AVATAR_MAX_BYTES);
    exactly.set([0xff, 0xd8, 0xff]);
    expect(prepareAvatar(exactly).ok).toBe(false); // right size, but not a real jpeg
    expect(prepareAvatar(jpeg(true).subarray(0, 12))).toEqual({ ok: false, error: "corrupt" });
    expect(prepareAvatar(png(false).subarray(0, 30))).toEqual({ ok: false, error: "corrupt" });
    expect(prepareAvatar(webp(false).subarray(0, 20))).toEqual({ ok: false, error: "corrupt" });
  });
});

describe("validateEmailChange", () => {
  it("normalises a good address", () => {
    expect(validateEmailChange("  New.Name@Example.com ", "old@example.com")).toEqual({ ok: true, email: "new.name@example.com" });
  });
  it("rejects empty, malformed and unchanged addresses", () => {
    expect(validateEmailChange("", "a@b.co")).toEqual({ ok: false, error: "empty" });
    expect(validateEmailChange(null, "a@b.co")).toEqual({ ok: false, error: "empty" });
    for (const bad of ["nope", "a@b", "a b@c.de", "a@@b.co", "@b.co", "a@.co"]) {
      expect(validateEmailChange(bad, "x@y.co"), bad).toEqual({ ok: false, error: "invalid" });
    }
    expect(validateEmailChange("A@B.co", "a@b.CO")).toEqual({ ok: false, error: "same" });
  });
});

describe("notification prefs", () => {
  const now = "2026-11-04T10:00:00.000Z";
  it("defaults: service messages on, marketing off and unstamped", () => {
    expect(DEFAULT_PREFS).toMatchObject({ booking_confirmations: true, reminders: true, marketing: false, marketing_consented_at: null });
  });
  it("stamps consent time and text version when marketing turns on", () => {
    const on = applyMarketingChoice(DEFAULT_PREFS, true, now);
    expect(on).toMatchObject({ marketing: true, marketing_consented_at: now, marketing_withdrawn_at: null, marketing_consent_version: MARKETING_CONSENT_VERSION });
  });
  it("records withdrawal, keeps the grant time, and does not re-stamp when unchanged", () => {
    const on = applyMarketingChoice(DEFAULT_PREFS, true, now);
    const off = applyMarketingChoice(on, false, "2026-11-05T00:00:00.000Z");
    expect(off).toMatchObject({ marketing: false, marketing_consented_at: now, marketing_withdrawn_at: "2026-11-05T00:00:00.000Z" });
    expect(applyMarketingChoice(on, true, "2027-01-01T00:00:00.000Z")).toBe(on);
  });
});
