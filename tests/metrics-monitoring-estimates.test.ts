import { describe, it, expect } from "vitest";
import { calculateMetricsCapacity } from "@/lib/metrics-monitoring-estimates";

describe("calculateMetricsCapacity", () => {
  const result = calculateMetricsCapacity({
    monitoredTargets: 1_000_000,
    seriesPerTarget: 200,
    scrapeIntervalSec: 10,
    rawBytesPerSample: 16,
    compressedBytesPerSample: 2,
  });

  it("derives the number of active time series", () => {
    expect(result.activeSeries).toBe(200_000_000);
  });
  it("derives the ingest sample rate (the write firehose)", () => {
    expect(result.ingestSamplesPerSec).toBe(20_000_000);
  });
  it("derives the raw storage per day", () => {
    expect(result.rawStoragePerDayTb).toBeCloseTo(27.648, 3);
  });
  it("derives the compressed storage per day", () => {
    expect(result.compressedStoragePerDayTb).toBeCloseTo(3.456, 3);
  });
  it("derives the time-series compression ratio", () => {
    expect(result.compressionRatio).toBe(8);
  });
});
