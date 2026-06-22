import { describe, it, expect } from "vitest";
import { calculateUrlShortenerCapacity } from "@/lib/url-shortener-estimates";

describe("calculateUrlShortenerCapacity", () => {
  const result = calculateUrlShortenerCapacity({
    newLinksPerMonth: 100_000_000,
    readWriteRatio: 100,
    peakMultiplier: 3,
    bytesPerMapping: 500,
    retentionYears: 5,
    cacheCoveragePercent: 20,
  });

  it("derives traffic from explicit assumptions", () => {
    expect(result.averageWriteQps).toBeCloseTo(38.58, 1);
    expect(result.averageReadQps).toBeCloseTo(3858, 0);
    expect(result.peakReadQps).toBeCloseTo(11574, 0);
  });

  it("derives storage and cache working set", () => {
    expect(result.totalMappings).toBe(6_000_000_000);
    expect(result.mappingStorageTB).toBeCloseTo(3, 1);
    expect(result.cacheWorkingSetGB).toBeCloseTo(600, 0);
  });
});
