import { describe, it, expect } from "vitest";
import { calculateOwaspRiskCapacity } from "@/lib/owasp-top-10-estimates";

describe("calculateOwaspRiskCapacity", () => {
  const result = calculateOwaspRiskCapacity({
    attackAttemptsPerDay: 1_000_000,
    blockRatePerLayer: 0.9,
    layers: 3,
  });

  it("derives breaches getting past a single control", () => {
    expect(result.singleControlBreaches).toBe(100_000);
  });
  it("derives breaches getting past three layered controls", () => {
    expect(result.layeredBreaches).toBe(1_000);
  });
  it("derives the defense-in-depth improvement over one control", () => {
    expect(result.defenseInDepthFactor).toBe(100);
  });
  it("derives the overall reduction versus no control", () => {
    expect(result.overallReductionFactor).toBe(1_000);
  });
});
