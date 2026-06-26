import { describe, it, expect } from "vitest";
import { calculateApiGatewayCapacity } from "@/lib/api-gateway-estimates";

describe("calculateApiGatewayCapacity", () => {
  const result = calculateApiGatewayCapacity({
    requestsPerDay: 10_000_000_000,
    peakFactor: 3,
    gatewayOverheadMs: 4,
    avgBackendLatencyMs: 80,
    instanceCapacityRps: 5_000,
    authCacheHitRate: 0.95,
    authStoreLatencyMs: 10,
  });

  it("derives average requests per second", () => {
    expect(result.avgRps).toBeCloseTo(115740.74, 1);
  });
  it("derives peak requests per second", () => {
    expect(result.peakRps).toBeCloseTo(347222.22, 1);
  });
  it("derives the number of gateway instances needed at peak", () => {
    expect(result.instancesNeeded).toBe(70);
  });
  it("derives the latency overhead the gateway adds as a percentage", () => {
    expect(result.latencyOverheadPct).toBeCloseTo(4.76, 2);
  });
  it("derives the effective (cached) auth-lookup latency", () => {
    expect(result.effectiveAuthLatencyMs).toBeCloseTo(0.5, 5);
  });
  it("derives the auth-store QPS after caching offload", () => {
    expect(result.authStoreQps).toBeCloseTo(17361.11, 1);
  });
});
