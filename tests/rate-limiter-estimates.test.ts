import { describe, it, expect } from "vitest";
import { calculateRateLimiterCapacity } from "@/lib/rate-limiter-estimates";

describe("calculateRateLimiterCapacity", () => {
  const result = calculateRateLimiterCapacity({
    peakRequestsPerSecond: 1_000_000,
    checksPerRequest: 1,
    activeKeys: 50_000_000,
    bytesPerCounter: 80,
    redisOpsPerNode: 100_000,
  });

  it("derives counter operations from request volume", () => {
    expect(result.counterOpsPerSecond).toBe(1_000_000);
  });

  it("derives counter memory from active keys", () => {
    // 50M keys * 80 bytes = 4e9 bytes = 4 GB
    expect(result.counterMemoryGB).toBeCloseTo(4, 3);
  });

  it("derives the Redis node count needed for peak ops", () => {
    // 1,000,000 ops / 100,000 ops-per-node = 10 nodes
    expect(result.redisNodesForOps).toBe(10);
  });
});
