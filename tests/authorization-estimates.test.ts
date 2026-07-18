import { describe, it, expect } from "vitest";
import { calculateAuthorizationCapacity } from "@/lib/authorization-estimates";

describe("calculateAuthorizationCapacity", () => {
  const result = calculateAuthorizationCapacity({
    requestsPerSec: 200_000,
    checksPerRequest: 3,
    decisionCpuMs: 0.5,
    cacheHitRate: 0.9,
    msPerCorePerSec: 1_000,
  });

  it("derives total permission checks per second", () => {
    expect(result.totalChecksPerSec).toBe(600_000);
  });
  it("derives cached checks per second", () => {
    expect(result.cachedChecksPerSec).toBe(540_000);
  });
  it("derives evaluated (uncached) checks per second", () => {
    expect(result.evaluatedChecksPerSec).toBe(60_000);
  });
  it("derives decision CPU milliseconds per second", () => {
    expect(result.decisionCpuMsPerSec).toBeCloseTo(30_000, 5);
  });
  it("sizes the decision fleet with a decision cache", () => {
    expect(result.coresWithCache).toBe(30);
  });
  it("sizes the decision fleet without a cache", () => {
    expect(result.coresWithoutCache).toBe(300);
  });
});
