import { describe, it, expect } from "vitest";
import { calculateTlsCapacity } from "@/lib/tls-estimates";

describe("calculateTlsCapacity", () => {
  const result = calculateTlsCapacity({
    newConnectionsPerSec: 50_000,
    fullHandshakeCpuMs: 2,
    resumedHandshakeCpuMs: 0.1,
    resumptionRate: 0.8,
    msPerCorePerSec: 1_000,
  });

  it("derives full (unresumed) handshakes per second", () => {
    expect(result.fullHandshakesPerSec).toBe(10_000);
  });
  it("derives resumed handshakes per second", () => {
    expect(result.resumedHandshakesPerSec).toBe(40_000);
  });
  it("derives total handshake CPU milliseconds per second", () => {
    expect(result.handshakeCpuMsPerSec).toBeCloseTo(24_000, 5);
  });
  it("sizes the TLS CPU fleet with session resumption", () => {
    expect(result.coresWithResumption).toBe(24);
  });
  it("sizes the TLS CPU fleet without resumption", () => {
    expect(result.coresWithoutResumption).toBe(100);
  });
});
