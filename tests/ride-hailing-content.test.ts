import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/tutorials/ride-hailing.mdx", "utf8");

const requiredIds = [
  "interview-framing",
  "requirements",
  "capacity-estimates",
  "entity-model",
  "api-design",
  "high-level-architecture",
  "detailed-flows",
  "geospatial-index",
  "location-updates",
  "matching-dispatch",
  "trip-state-machine",
  "real-time-tracking",
  "supply-demand-surge",
  "scalability-evolution",
  "resiliency-failure-modes",
  "tradeoffs-alternatives",
  "interview-summary",
  "knowledge-checks-faq",
];

describe("Ride-Hailing tutorial content", () => {
  it("contains all eighteen required section anchors", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the capacity model, architecture, and all four flow diagrams", () => {
    for (const tag of [
      "<RideHailingCapacity",
      "<RideHailingArchitecture",
      "<LocationUpdateSequence",
      "<MatchRideSequence",
      "<TripStateSequence",
      "<LiveTrackingSequence",
    ]) {
      expect(content).toContain(tag);
    }
  });

  it("embeds capacity assumptions matching the estimates test", () => {
    expect(content).toContain("activeDrivers: 5000000");
    expect(content).toContain("pingIntervalSec: 4");
    expect(content).toContain("locationBytes: 100");
    expect(content).toContain("ridesPerDay: 50000000");
    expect(content).toContain("candidatesPerMatch: 10");
  });

  it("includes at least six knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("includes at least twelve FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(12);
  });
});
