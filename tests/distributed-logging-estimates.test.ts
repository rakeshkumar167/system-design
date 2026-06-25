// tests/distributed-logging-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculateDistributedLoggingCapacity } from "@/lib/distributed-logging-estimates";

describe("calculateDistributedLoggingCapacity", () => {
  const result = calculateDistributedLoggingCapacity({
    dailyLogEvents: 500_000_000_000,
    avgEventBytes: 500,
    peakFactor: 3,
    compressionRatio: 0.1,
    indexFraction: 0.3,
    hotRetentionDays: 7,
    coldRetentionDays: 365,
  });

  it("derives average events per second", () => {
    expect(result.avgEventsPerSecond).toBeCloseTo(5787037.04, 1);
  });
  it("derives peak events per second", () => {
    expect(result.peakEventsPerSecond).toBeCloseTo(17361111.11, 1);
  });
  it("derives daily raw volume in TB", () => {
    expect(result.dailyRawTb).toBe(250);
  });
  it("derives index storage over the hot window in TB", () => {
    expect(result.indexStorageTb).toBeCloseTo(525, 5);
  });
  it("derives cold-tier storage over the retention window in PB", () => {
    expect(result.coldStoragePb).toBeCloseTo(9.125, 3);
  });
});
