import { describe, expect, it } from "vitest";
import { formatCompactPtBr, formatIntegerPtBr, formatPtBr } from "./format";

describe("formatters pt-BR", () => {
  it("preserves every digit in integer counts with thousands separators", () => {
    expect(formatIntegerPtBr(1745)).toBe("1.745");
    expect(formatIntegerPtBr(1_234_567)).toBe("1.234.567");
  });

  it("formats metric percentages with one decimal place", () => {
    expect(formatPtBr(7.345, 1)).toBe("7,3");
    expect(formatPtBr(7, 1)).toBe("7,0");
  });

  it("keeps compact formatting available for other KPIs", () => {
    expect(formatCompactPtBr(1745)).toBe("1,7 mil");
  });
});
