import { describe, expect, it } from "vitest";
import {
  buildInvoice, DEFAULT_BILLING_SETTINGS, formatInvoiceNumber, formatMoney, InvoiceNumberer, maskTaxId, renderReceiptData,
  vatIncluded,
} from "./invoice";

const buyer = { displayName: "Nong Barber" };
const base = (over: Record<string, unknown> = {}) => {
  const n = new InvoiceNumberer();
  return buildInvoice({
    businessId: "b1", plan: "pro", founding: false, anchor: "2026-11-03", periodIndex: 1, buyer,
    issuedAt: new Date("2026-12-03T05:00:00Z"), numbering: n.allocate(2026), paymentRef: "mock_ch_1", ...over,
  });
};

describe("numbering", () => {
  it("is sequential and gap-free, per Bangkok year", () => {
    const n = new InvoiceNumberer();
    expect([n.allocate(2026).number, n.allocate(2026).number]).toEqual(["TN-2026-000001", "TN-2026-000002"]);
    expect(n.allocate(2027).number).toBe("TN-2027-000001");
    expect(n.allocate(2026).seq).toBe(3);
    expect(formatInvoiceNumber(2026, 1234567)).toBe("TN-2026-1234567");
  });
});

describe("VAT", () => {
  it("is off by default: no VAT line, total = price", () => {
    expect(DEFAULT_BILLING_SETTINGS.vatEnabled).toBe(false);
    const i = base();
    expect(i.kind).toBe("receipt");
    expect([i.vatApplied, i.vatSatang, i.vatRateBp]).toEqual([false, 0, 0]);
    expect([i.subtotalSatang, i.totalSatang]).toEqual([49_000, 49_000]);
    expect(renderReceiptData(i, "th").vat).toBeNull();
  });
  it("when on, the price includes VAT and the parts add up exactly", () => {
    for (const [plan, founding, idx] of [["pro", false, 1], ["studio", false, 1], ["pro", true, 3]] as const) {
      const i = base({ plan, founding, periodIndex: idx, settings: { ...DEFAULT_BILLING_SETTINGS, vatEnabled: true } });
      expect(i.subtotalSatang + i.vatSatang).toBe(i.totalSatang);
      expect(i.vatSatang).toBe(vatIncluded(i.totalSatang, 700));
      expect(i.lines.reduce((a, l) => a + l.amountSatang, 0)).toBe(i.subtotalSatang);
      expect(i.kind).toBe("receipt_tax_invoice");
    }
    expect(vatIncluded(49_000, 700)).toBe(3_206); // THB 32.06 of 490.00
  });
  it("full form needs the buyer's legal name, tax id and address", () => {
    const on = { ...DEFAULT_BILLING_SETTINGS, vatEnabled: true };
    expect(base({ settings: on }).fullForm).toBe(false);
    const full = base({ settings: on, buyer: { displayName: "x", legalName: "Nong Co", taxId: "0105500000001", address: "Bangkok" } });
    expect(full.fullForm).toBe(true);
    expect(renderReceiptData(full, "en").title).toBe("Receipt / Tax invoice");
  });
});

describe("invoices", () => {
  it("founding free months have no invoice; the first paid one is THB 290", () => {
    expect(() => base({ founding: true, periodIndex: 0 })).toThrow();
    const i = base({ founding: true, periodIndex: 3, anchor: "2026-11-03" });
    expect(i.totalSatang).toBe(29_000);
    expect(i.lines[0]?.descriptionEn).toContain("founding");
  });
  it("covers the period inclusive of its last day", () => {
    const i = base();
    expect([i.periodStart, i.periodEnd]).toEqual(["2026-12-03", "2027-01-02"]);
  });
  it("renders Thai with Buddhist-era dates and English with plain ones", () => {
    const i = base();
    const th = renderReceiptData(i, "th");
    const en = renderReceiptData(i, "en");
    expect(th.title).toBe("ใบเสร็จรับเงิน");
    expect(th.date).toBe("3 ธันวาคม 2569");
    expect(th.total).toBe("490.00 บาท");
    expect(th.lines[0]?.description).toContain("โปร");
    expect(th.vatNote).toContain("ไม่ได้จดทะเบียน");
    expect(en.title).toBe("Receipt");
    expect(en.date).toBe("3 December 2026");
    expect(en.total).toBe("THB 490.00");
    expect(en.period).toBe("3 December 2026 - 2 January 2027");
  });
  it("formats money and masks tax ids", () => {
    expect(formatMoney(123_456_789, "en")).toBe("THB 1,234,567.89");
    expect(formatMoney(5, "th")).toBe("0.05 บาท");
    expect(maskTaxId("0105500000001")).toBe("*********0001");
    const i = base({ buyer: { displayName: "x", taxId: "0105500000001" } });
    expect(renderReceiptData(i, "en").buyerLines.join(" ")).not.toContain("0105500000001");
  });
});
