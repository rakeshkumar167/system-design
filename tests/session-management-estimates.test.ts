import { describe, it, expect } from "vitest";
import { calculateSessionCapacity } from "@/lib/session-management-estimates";

describe("calculateSessionCapacity", () => {
  const result = calculateSessionCapacity({
    requestsPerSec: 300_000,
    activeSessions: 50_000_000,
    sessionBytes: 1_000,
    cacheHitRate: 0.95,
    bytesPerGb: 1_000_000_000,
  });

  it("derives store lookups per second without a cache", () => {
    expect(result.storeLookupsWithoutCache).toBe(300_000);
  });
  it("derives store lookups per second with a session cache", () => {
    expect(result.storeLookupsWithCache).toBe(15_000);
  });
  it("derives the lookup reduction factor from caching", () => {
    expect(result.lookupReductionFactor).toBe(20);
  });
  it("derives the memory to hold every active session", () => {
    expect(result.sessionStoreMemoryGb).toBe(50);
  });
});
