// Invoice and receipt DATA. No PDF here: this builds the numbers and the Thai /
// English wording that a later renderer (PDF or screen) will print.
//
// VAT (Legal handoff 02 section A): TatNat is below the THB 1.8M a year line, so
// it must neither charge nor show VAT. VAT handling is therefore OFF by default
// (BillingSettings.vatEnabled = false). Flip it once registered; the plan price
// then becomes VAT-inclusive and the VAT part is shown separately.
import { PLANS, periodPriceSatang, periodStart, thb, type PlanId } from "./plans";
import { addDays, bangkokDate, type BDate } from "./time";

export interface BillingSettings {
  vatEnabled: boolean;
  /** 700 = 7.00% */
  vatRateBp: number;
  /** Registration is compulsory above this yearly revenue. Informational flag for later. */
  vatThresholdSatang: number;
}

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  vatEnabled: false,
  vatRateBp: 700,
  vatThresholdSatang: thb(1_800_000),
};

export interface Buyer {
  displayName: string;
  legalName?: string;
  /** 13 digits. Masked on receipts. */
  taxId?: string;
  branch?: string;
  address?: string;
}

export interface InvoiceLine {
  descriptionTh: string;
  descriptionEn: string;
  quantity: number;
  unitSatang: number;
  amountSatang: number;
}

export type InvoiceKind = "receipt" | "receipt_tax_invoice";

export interface Invoice {
  number: string;
  seq: number;
  year: number;
  kind: InvoiceKind;
  /** Full-form tax invoice (buyer legal name, tax ID and address present). Only meaningful when VAT is on. */
  fullForm: boolean;
  businessId: string;
  issuedAt: Date;
  issueDate: BDate;
  periodStart: BDate;
  /** Inclusive last day of the period. */
  periodEnd: BDate;
  currency: "THB";
  lines: InvoiceLine[];
  subtotalSatang: number;
  vatSatang: number;
  vatRateBp: number;
  vatApplied: boolean;
  totalSatang: number;
  buyer: Buyer;
  paymentRef: string;
}

export const formatInvoiceNumber = (year: number, seq: number): string =>
  `TN-${year}-${String(seq).padStart(6, "0")}`;

/** Gap-free, per-year counter. Mirrors the SQL allocator in the billing migration. */
export class InvoiceNumberer {
  private last = new Map<number, number>();
  allocate(year: number): { year: number; seq: number; number: string } {
    const seq = (this.last.get(year) ?? 0) + 1;
    this.last.set(year, seq);
    return { year, seq, number: formatInvoiceNumber(year, seq) };
  }
}

/** VAT contained in a VAT-inclusive total. */
export const vatIncluded = (totalSatang: number, rateBp: number): number =>
  Math.round((totalSatang * rateBp) / (10_000 + rateBp));

export function buildInvoice(input: {
  businessId: string;
  plan: PlanId;
  founding: boolean;
  anchor: BDate;
  periodIndex: number;
  settings?: BillingSettings;
  buyer: Buyer;
  issuedAt: Date;
  numbering: { year: number; seq: number; number: string };
  paymentRef: string;
}): Invoice {
  const settings = input.settings ?? DEFAULT_BILLING_SETTINGS;
  const total = periodPriceSatang(input.plan, input.founding, input.periodIndex);
  if (total <= 0) throw new Error("No invoice for a free period");
  const plan = PLANS[input.plan];
  const start = periodStart(input.anchor, input.periodIndex);
  const end = addDays(periodStart(input.anchor, input.periodIndex + 1), -1);
  const vat = settings.vatEnabled ? vatIncluded(total, settings.vatRateBp) : 0;
  const founding = input.founding && total !== plan.priceSatang;
  const b = input.buyer;
  return {
    ...input.numbering,
    kind: settings.vatEnabled ? "receipt_tax_invoice" : "receipt",
    fullForm: settings.vatEnabled && !!(b.legalName && b.taxId && b.address),
    businessId: input.businessId,
    issuedAt: input.issuedAt,
    issueDate: bangkokDate(input.issuedAt),
    periodStart: start,
    periodEnd: end,
    currency: "THB",
    lines: [
      {
        descriptionTh: `แพ็กเกจ ${plan.nameTh} รายเดือน${founding ? " (ราคาร้านผู้ก่อตั้ง)" : ""}`,
        descriptionEn: `${plan.nameEn} plan, monthly${founding ? " (founding shop price)" : ""}`,
        quantity: 1,
        unitSatang: settings.vatEnabled ? total - vat : total,
        amountSatang: settings.vatEnabled ? total - vat : total,
      },
    ],
    subtotalSatang: total - vat,
    vatSatang: vat,
    vatRateBp: settings.vatEnabled ? settings.vatRateBp : 0,
    vatApplied: settings.vatEnabled,
    totalSatang: total,
    buyer: b,
    paymentRef: input.paymentRef,
  };
}

// ---------------------------------------------------------------------------
// Receipt render data (Thai / English)
// ---------------------------------------------------------------------------
export type Locale = "th" | "en";

const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "3 พฤศจิกายน 2569" (Buddhist Era) or "3 November 2026". */
export function formatDate(date: BDate, locale: Locale): string {
  const [y = 0, m = 1, d = 0] = date.split("-").map(Number);
  return locale === "th" ? `${d} ${TH_MONTHS[m - 1]} ${y + 543}` : `${d} ${EN_MONTHS[m - 1]} ${y}`;
}

export function formatMoney(satang: number, locale: Locale): string {
  const sign = satang < 0 ? "-" : "";
  const abs = Math.abs(satang);
  const baht = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const text = `${sign}${baht}.${String(abs % 100).padStart(2, "0")}`;
  return locale === "th" ? `${text} บาท` : `THB ${text}`;
}

export const maskTaxId = (id: string): string => (id.length > 4 ? "*".repeat(id.length - 4) + id.slice(-4) : id);

export interface ReceiptData {
  locale: Locale;
  title: string;
  number: string;
  dateLabel: string;
  date: string;
  periodLabel: string;
  period: string;
  buyerLines: string[];
  lines: { description: string; quantity: number; unit: string; amount: string }[];
  subtotal: string;
  vat: string | null;
  total: string;
  vatNote: string;
  paymentRef: string;
}

export function renderReceiptData(inv: Invoice, locale: Locale): ReceiptData {
  const th = locale === "th";
  const b = inv.buyer;
  const buyerLines = [b.legalName ?? b.displayName];
  if (b.taxId) buyerLines.push(`${th ? "เลขประจำตัวผู้เสียภาษี" : "Tax ID"}: ${maskTaxId(b.taxId)}`);
  if (b.branch) buyerLines.push(`${th ? "สาขา" : "Branch"}: ${b.branch}`);
  if (b.address) buyerLines.push(b.address);
  const title =
    inv.kind === "receipt"
      ? th ? "ใบเสร็จรับเงิน" : "Receipt"
      : inv.fullForm
        ? th ? "ใบเสร็จรับเงิน/ใบกำกับภาษี" : "Receipt / Tax invoice"
        : th ? "ใบเสร็จรับเงิน/ใบกำกับภาษีอย่างย่อ" : "Receipt / Abbreviated tax invoice";
  return {
    locale,
    title,
    number: inv.number,
    dateLabel: th ? "วันที่" : "Date",
    date: formatDate(inv.issueDate, locale),
    periodLabel: th ? "รอบบริการ" : "Service period",
    period: `${formatDate(inv.periodStart, locale)} - ${formatDate(inv.periodEnd, locale)}`,
    buyerLines,
    lines: inv.lines.map((l) => ({
      description: th ? l.descriptionTh : l.descriptionEn,
      quantity: l.quantity,
      unit: formatMoney(l.unitSatang, locale),
      amount: formatMoney(l.amountSatang, locale),
    })),
    subtotal: formatMoney(inv.subtotalSatang, locale),
    vat: inv.vatApplied ? formatMoney(inv.vatSatang, locale) : null,
    total: formatMoney(inv.totalSatang, locale),
    vatNote: inv.vatApplied
      ? th ? `ราคารวมภาษีมูลค่าเพิ่ม ${inv.vatRateBp / 100}% แล้ว` : `Price includes ${inv.vatRateBp / 100}% VAT`
      : th ? "ไม่ได้จดทะเบียนภาษีมูลค่าเพิ่ม จึงไม่มีการเรียกเก็บภาษี" : "Not VAT registered; no VAT is charged",
    paymentRef: inv.paymentRef,
  };
}
