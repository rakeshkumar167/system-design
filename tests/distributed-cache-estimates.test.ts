import { describe, it, expect } from "vitest";
import { calculateDistributedCacheCapacity } from "@/lib/distributed-cache-estimates";

describe("calculateDistributedCacheCapacity", () => {
  const result = calculateDistributedCacheCapacity({
    totalItems: 10_000_000_000,
    avgItemBytes: 1_000,
    cacheableFraction: 0.2,
    memoryPerNodeGb: 64,
    peakReadsPerSecond: 50_000_000,
    hitRatio: 0.95,
  });

  it("derives the total dataset size in TB", () => {
    expect(result.totalDatasetTb).toBe(10);
  });
  it("derives the cached working set in GB", () => {
    expect(result.workingSetGb).toBeCloseTo(2000, 5);
  });
  it("derives the number of cache nodes (rounded up)", () => {
    expect(result.nodesNeeded).toBe(32);
  });
  it("derives backing-store reads per second after the hit ratio", () => {
    expect(result.backingStoreReadsPerSecond).toBeCloseTo(2_500_000, 0);
  });
  it("derives per-node read throughput", () => {
    expect(result.readsPerNodePerSecond).toBe(1_562_500);
  });
});
