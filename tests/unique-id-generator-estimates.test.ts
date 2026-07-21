import { describe, it, expect } from "vitest";
import { calculateSnowflakeCapacity } from "@/lib/unique-id-generator-estimates";

describe("calculateSnowflakeCapacity", () => {
  const result = calculateSnowflakeCapacity({
    timeBits: 41,
    machineBits: 10,
    sequenceBits: 12,
    peakIdsPerSec: 1_000_000,
  });

  it("derives the total bit width", () => {
    expect(result.totalBits).toBe(64);
  });
  it("derives IDs per millisecond per node", () => {
    expect(result.idsPerMsPerNode).toBe(4096);
  });
  it("derives IDs per second per node", () => {
    expect(result.idsPerSecPerNode).toBe(4_096_000);
  });
  it("derives the maximum number of nodes", () => {
    expect(result.maxNodes).toBe(1024);
  });
  it("derives the maximum IDs per second across the fleet", () => {
    expect(result.maxIdsPerSec).toBe(4_194_304_000);
  });
  it("derives the timestamp lifespan in years", () => {
    expect(result.lifespanYears).toBeCloseTo(69.73, 2);
  });
  it("derives the nodes needed for peak demand", () => {
    expect(result.nodesForPeakDemand).toBe(1);
  });
});
