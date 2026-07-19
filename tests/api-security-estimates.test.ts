import { describe, it, expect } from "vitest";
import { calculateApiSecurityCapacity } from "@/lib/api-security-estimates";

describe("calculateApiSecurityCapacity", () => {
  const result = calculateApiSecurityCapacity({
    requestsPerSec: 200_000,
    abusiveFraction: 0.5,
    gatewayCheckCpuMs: 0.25,
    backendCpuMs: 5,
    msPerCorePerSec: 1_000,
  });

  it("sizes the edge security-check fleet", () => {
    expect(result.gatewaySecurityCores).toBe(50);
  });
  it("sizes the backend when all traffic is served", () => {
    expect(result.backendCoresWithoutFiltering).toBe(1_000);
  });
  it("sizes the backend when abusive traffic is filtered at the edge", () => {
    expect(result.backendCoresWithFiltering).toBe(500);
  });
  it("derives the net cores saved by filtering early", () => {
    expect(result.netCoresSaved).toBe(450);
  });
});
