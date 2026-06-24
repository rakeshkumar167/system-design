// tests/cloud-drive-estimates.test.ts
import { describe, it, expect } from "vitest";
import { calculateCloudDriveCapacity } from "@/lib/cloud-drive-estimates";

describe("calculateCloudDriveCapacity", () => {
  const result = calculateCloudDriveCapacity({
    totalUsers: 500_000_000,
    avgStorageGbPerUser: 10,
    dedupRatio: 0.3,
    dailyActiveUsers: 50_000_000,
    avgDailyEditsPerActiveUser: 100,
    avgEditBytes: 4_000_000,
    deltaSyncFraction: 0.1,
  });

  it("derives the raw stored bytes in EB", () => {
    expect(result.rawStorageEb).toBe(5);
  });
  it("derives the physical storage after dedup in EB", () => {
    expect(result.physicalStorageEb).toBeCloseTo(3.5, 5);
  });
  it("derives the metadata write QPS", () => {
    expect(result.metadataWritesPerSecond).toBeCloseTo(57870.37, 1);
  });
  it("derives the naive (whole-file) upload bandwidth in GB/s", () => {
    expect(result.naiveUploadGbPerSecond).toBeCloseTo(231.48, 1);
  });
  it("derives the delta-sync upload bandwidth in GB/s", () => {
    expect(result.deltaUploadGbPerSecond).toBeCloseTo(23.15, 1);
  });
});
