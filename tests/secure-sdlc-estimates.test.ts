import { describe, it, expect } from "vitest";
import { calculateSecureSdlcCapacity } from "@/lib/secure-sdlc-estimates";

describe("calculateSecureSdlcCapacity", () => {
  const result = calculateSecureSdlcCapacity({
    vulnsPerRelease: 100,
    costFixInDesign: 100,
    prodCostMultiplier: 100,
    shiftLeftCatchRate: 0.9,
  });

  it("derives the cost to fix one flaw in production", () => {
    expect(result.prodCostPerVuln).toBe(10_000);
  });
  it("derives the total cost if every flaw is found in production", () => {
    expect(result.baselineCostAllInProd).toBe(1_000_000);
  });
  it("derives the total cost when 90% are caught early", () => {
    expect(result.shiftLeftTotalCost).toBe(109_000);
  });
  it("derives the cost saved by shifting left", () => {
    expect(result.costSaved).toBe(891_000);
  });
});
