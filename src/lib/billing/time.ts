// Asia/Bangkok calendar maths. Thailand has no daylight saving: always UTC+7.
// A "BDate" is a calendar date string, YYYY-MM-DD, as a person in Bangkok reads it.
// Every due date, reminder and grace boundary in billing is a BDate, so the
// result never depends on the server's time zone.

export type BDate = string;

const OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The Bangkok calendar date of an instant. */
export function bangkokDate(instant: Date): BDate {
  return new Date(instant.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant a Bangkok calendar day starts (00:00 Bangkok = 17:00Z the day before). */
export function startOfBangkokDay(date: BDate): Date {
  const [y, m, d] = parse(date);
  return new Date(Date.UTC(y, m - 1, d) - OFFSET_MS);
}

export function addDays(date: BDate, days: number): BDate {
  const [y, m, d] = parse(date);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: BDate, b: BDate): number {
  const [ay, am, ad] = parse(a);
  const [by, bm, bd] = parse(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS);
}

/**
 * anchor + n months, always counted from the anchor (not from the previous
 * result), and clamped to the month's last day: 31 Jan -> 28 Feb -> 31 Mar.
 */
export function addMonths(anchor: BDate, months: number): BDate {
  const [y, m, d] = parse(anchor);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return fmt(ny, nm + 1, Math.min(d, last));
}

function parse(date: BDate): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function fmt(y: number, m: number, d: number): BDate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
