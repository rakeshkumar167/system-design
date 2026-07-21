import { describe, it, expect } from "vitest";
import { calculateCdnCapacity } from "@/lib/content-delivery-network-estimates";

describe("calculateCdnCapacity", () => {
  const result = calculateCdnCapacity({
    dailyRequests: 1_728_000_000_000,
    cacheHitPercent: 95,
    improvedHitPercent: 99,
    avgObjectBytes: 100_000,
  });

  it("derives the edge request rate", () => {
    expect(result.edgeRequestsPerSec).toBe(20_000_000);
  });
  it("derives the origin request rate at the current hit ratio", () => {
    expect(result.originRequestsPerSec).toBe(1_000_000);
  });
  it("derives the origin offload factor", () => {
    expect(result.offloadFactor).toBe(20);
  });
  it("derives the origin request rate at the improved hit ratio", () => {
    expect(result.originRequestsAtImprovedHitRatio).toBe(200_000);
  });
  it("derives how much further the improved hit ratio reduces origin load", () => {
    expect(result.originReductionFactor).toBe(5);
  });
  it("derives the edge egress bandwidth", () => {
    expect(result.edgeEgressGbPerSec).toBe(2000);
  });
  it("derives the origin egress bandwidth", () => {
    expect(result.originEgressGbPerSec).toBe(100);
  });
});
