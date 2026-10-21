import { describe, expect, it } from "vitest";
import {
  bookableStaffFor,
  resolveStaffCandidates,
  staffCanPerform,
  staffWorksWeekday,
  type StaffWithServices,
} from "./staff-eligibility";

// 2026-04-10 is a Friday; 2026-04-12 is a Sunday — reuses the no-collision
// date 40_multi_staff.sql picked for the same reason (independent of any
// other fixture).
const FRIDAY = "2026-04-10";
const SUNDAY = "2026-04-12";

const CUT = "service-cut";
const COLOR = "service-color";

function staff(overrides: Partial<StaffWithServices> = {}): StaffWithServices {
  return {
    id: "staff-1",
    business_id: "biz-1",
    name: "Nong",
    avatar_url: null,
    works_weekdays: [0, 1, 2, 3, 4, 5, 6],
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    serviceIds: [],
    ...overrides,
  };
}

describe("staffCanPerform", () => {
  it("performs everything when staff_services has no rows (default-open)", () => {
    expect(staffCanPerform(staff({ serviceIds: [] }), CUT)).toBe(true);
    expect(staffCanPerform(staff({ serviceIds: [] }), COLOR)).toBe(true);
  });

  it("is narrowed to exactly its assigned services once any row exists", () => {
    const narrowed = staff({ serviceIds: [CUT] });
    expect(staffCanPerform(narrowed, CUT)).toBe(true);
    expect(staffCanPerform(narrowed, COLOR)).toBe(false);
  });
});

describe("staffWorksWeekday", () => {
  it("is true for a weekday in works_weekdays", () => {
    expect(staffWorksWeekday(staff({ works_weekdays: [1, 2, 3, 4, 5] }), FRIDAY)).toBe(true);
  });

  it("is false for a weekday not in works_weekdays", () => {
    expect(staffWorksWeekday(staff({ works_weekdays: [1, 2, 3, 4, 5] }), SUNDAY)).toBe(false);
  });
});

describe("bookableStaffFor", () => {
  const active = staff({ id: "active", is_active: true });
  const inactive = staff({ id: "inactive", is_active: false });
  const wrongService = staff({ id: "wrong-service", serviceIds: [COLOR] });
  const offThatDay = staff({ id: "off-that-day", works_weekdays: [0] }); // Sunday only

  it("excludes inactive staff", () => {
    const result = bookableStaffFor([active, inactive], CUT, FRIDAY);
    expect(result.map((s) => s.id)).toEqual(["active"]);
  });

  it("excludes staff narrowed away from the requested service", () => {
    const result = bookableStaffFor([active, wrongService], CUT, FRIDAY);
    expect(result.map((s) => s.id)).toEqual(["active"]);
  });

  it("excludes staff not rostered to work that weekday", () => {
    const result = bookableStaffFor([active, offThatDay], CUT, FRIDAY);
    expect(result.map((s) => s.id)).toEqual(["active"]);
  });

  it("returns every eligible staff member when more than one qualifies", () => {
    const other = staff({ id: "other" });
    const result = bookableStaffFor([active, other], CUT, FRIDAY);
    expect(result.map((s) => s.id).sort()).toEqual(["active", "other"]);
  });

  it("returns empty when nobody qualifies", () => {
    expect(bookableStaffFor([inactive, wrongService], CUT, FRIDAY)).toEqual([]);
  });
});

describe("resolveStaffCandidates", () => {
  it("is the single-null candidate for a business with no staff at all", () => {
    const result = resolveStaffCandidates([], CUT, FRIDAY, undefined);
    expect(result).toEqual({ ok: true, candidateIds: [null], isNamedChoice: false });
  });

  it("is every eligible staff member, in order, for 'any available'", () => {
    const a = staff({ id: "a" });
    const b = staff({ id: "b" });
    const result = resolveStaffCandidates([a, b], CUT, FRIDAY, "any");
    expect(result).toEqual({ ok: true, candidateIds: ["a", "b"], isNamedChoice: false });
  });

  it("treats an empty/omitted staffId the same as 'any available'", () => {
    const a = staff({ id: "a" });
    expect(resolveStaffCandidates([a], CUT, FRIDAY, undefined)).toEqual({
      ok: true,
      candidateIds: ["a"],
      isNamedChoice: false,
    });
    expect(resolveStaffCandidates([a], CUT, FRIDAY, "")).toEqual({
      ok: true,
      candidateIds: ["a"],
      isNamedChoice: false,
    });
  });

  it("is a single named candidate, flagged isNamedChoice, when the customer named an eligible barber", () => {
    const a = staff({ id: "a" });
    const b = staff({ id: "b" });
    const result = resolveStaffCandidates([a, b], CUT, FRIDAY, "b");
    expect(result).toEqual({ ok: true, candidateIds: ["b"], isNamedChoice: true });
  });

  it("fails with staff_unavailable when the named barber isn't eligible", () => {
    const a = staff({ id: "a" });
    const inactiveB = staff({ id: "b", is_active: false });
    const result = resolveStaffCandidates([a, inactiveB], CUT, FRIDAY, "b");
    expect(result).toEqual({ ok: false, reason: "staff_unavailable" });
  });

  it("fails with staff_unavailable when the named barber id doesn't exist at all", () => {
    const a = staff({ id: "a" });
    const result = resolveStaffCandidates([a], CUT, FRIDAY, "does-not-exist");
    expect(result).toEqual({ ok: false, reason: "staff_unavailable" });
  });

  it("fails with no_staff_available when the business has staff but none are eligible", () => {
    const inactive = staff({ is_active: false });
    const result = resolveStaffCandidates([inactive], CUT, FRIDAY, "any");
    expect(result).toEqual({ ok: false, reason: "no_staff_available" });
  });
});
