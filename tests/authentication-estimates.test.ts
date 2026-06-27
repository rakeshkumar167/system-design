import { describe, it, expect } from "vitest";
import { calculateAuthenticationCapacity } from "@/lib/authentication-estimates";

describe("calculateAuthenticationCapacity", () => {
  const result = calculateAuthenticationCapacity({
    dailyActiveUsers: 50_000_000,
    authedRequestsPerUserPerDay: 200,
    peakMultiplier: 3,
    sessionStoreReadsPerNode: 50_000,
  });

  it("derives average authenticated requests per second", () => {
    expect(result.avgRequestsPerSec).toBeCloseTo(115740.74, 1);
  });
  it("derives peak authenticated requests per second", () => {
    expect(result.peakRequestsPerSec).toBeCloseTo(347222.22, 1);
  });
  it("charges stateful sessions one central read per request", () => {
    expect(result.statefulSessionReadsPerSec).toBeCloseTo(347222.22, 1);
  });
  it("sizes the session-store fleet for peak read load", () => {
    expect(result.statefulSessionStoreNodes).toBe(7);
  });
  it("charges stateless token verification zero central reads", () => {
    expect(result.statelessVerifyReadsPerSec).toBe(0);
  });
});
