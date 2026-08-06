import { describe, expect, it } from "vitest";
import { formatUsdc, formatUsdcExact, toMicros } from "../src/payments/money.js";

describe("toMicros", () => {
  it("parses dollar-prefixed and bare amounts identically", () => {
    expect(toMicros("$0.02")).toBe(20_000n);
    expect(toMicros("0.02")).toBe(20_000n);
  });

  it("parses whole amounts", () => {
    expect(toMicros("2")).toBe(2_000_000n);
    expect(toMicros("$0")).toBe(0n);
  });

  it("pads fractional digits to full micro precision", () => {
    expect(toMicros("$0.1")).toBe(100_000n);
    expect(toMicros("$0.000001")).toBe(1n);
  });

  it("rejects sub-micro precision rather than silently truncating", () => {
    expect(() => toMicros("$0.0000001")).toThrow(/Invalid USDC amount/);
  });

  it("rejects malformed amounts", () => {
    for (const value of ["", "abc", "$", "1.2.3", "-1", "$-0.01", "1,000"]) {
      expect(() => toMicros(value), `expected "${value}" to be rejected`).toThrow();
    }
  });

  it("tolerates surrounding whitespace", () => {
    expect(toMicros("  $1.50  ")).toBe(1_500_000n);
  });
});

describe("formatUsdc", () => {
  it("renders two decimal places for display", () => {
    expect(formatUsdc(0n)).toBe("$0.00");
    expect(formatUsdc(20_000n)).toBe("$0.02");
    expect(formatUsdc(2_000_000n)).toBe("$2.00");
  });

  it("keeps full precision for receipts", () => {
    expect(formatUsdcExact(1n)).toBe("$0.000001");
    expect(formatUsdcExact(90_000n)).toBe("$0.090000");
  });

  it("round-trips through toMicros", () => {
    for (const value of ["$0.01", "$0.02", "$2.00", "$0.09"]) {
      expect(formatUsdc(toMicros(value))).toBe(value);
    }
  });

  it("refuses negative amounts", () => {
    expect(() => formatUsdc(-1n)).toThrow(/cannot be negative/);
  });
});
