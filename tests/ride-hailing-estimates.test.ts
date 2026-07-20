import { describe, it, expect } from "vitest";
import { calculateRideHailingCapacity } from "@/lib/ride-hailing-estimates";

describe("calculateRideHailingCapacity", () => {
  const result = calculateRideHailingCapacity({
    activeDrivers: 5_000_000,
    pingIntervalSec: 4,
    locationBytes: 100,
    ridesPerDay: 50_000_000,
    candidatesPerMatch: 10,
  });

  it("derives the location-update firehose rate", () => {
    expect(result.locationUpdatesPerSec).toBe(1_250_000);
  });
  it("derives the location write bandwidth", () => {
    expect(result.locationWriteMbPerSec).toBe(125);
  });
  it("derives the ride-request rate", () => {
    expect(result.ridesPerSec).toBeCloseTo(578.70, 1);
  });
  it("derives how far location writes dwarf ride requests", () => {
    expect(result.writeToRequestRatio).toBeCloseTo(2160, 0);
  });
  it("derives the candidate-evaluation rate for matching", () => {
    expect(result.candidateEvaluationsPerSec).toBeCloseTo(5787.04, 1);
  });
});
