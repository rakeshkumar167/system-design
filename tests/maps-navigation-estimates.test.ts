import { describe, it, expect } from "vitest";
import { calculateMapsNavigationCapacity } from "@/lib/maps-navigation-estimates";

describe("calculateMapsNavigationCapacity", () => {
  const result = calculateMapsNavigationCapacity({
    nodes: 50_000_000,
    edges: 120_000_000,
    bytesPerEdge: 32,
    routeRequestsPerDay: 1_000_000_000,
    tilesPerRoute: 50,
    dijkstraSettledFraction: 0.5,
    chNodesPerQuery: 400,
  });

  it("derives average route QPS", () => {
    expect(result.avgRouteQps).toBeCloseTo(11574.07, 1);
  });
  it("derives average tile QPS (tiles dwarf routes)", () => {
    expect(result.avgTileQps).toBeCloseTo(578703.70, 1);
  });
  it("derives the in-RAM routable graph size in GB", () => {
    expect(result.graphSizeGb).toBe(3.84);
  });
  it("derives Dijkstra nodes settled per query", () => {
    expect(result.dijkstraNodesPerQuery).toBe(25_000_000);
  });
  it("derives naive settles per second in billions (the impossibility)", () => {
    expect(result.naiveSettlesPerSecBillions).toBeCloseTo(289.35, 1);
  });
  it("derives the contraction-hierarchy speed-up", () => {
    expect(result.chSpeedup).toBe(62_500);
  });
});
