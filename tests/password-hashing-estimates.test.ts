import { describe, it, expect } from "vitest";
import { calculatePasswordHashingCapacity } from "@/lib/password-hashing-estimates";

describe("calculatePasswordHashingCapacity", () => {
  const result = calculatePasswordHashingCapacity({
    loginsPerSec: 5_000,
    hashCostMs: 250,
    hashMemoryMiB: 64,
    msPerCorePerSec: 1_000,
    attackerFastHashesPerSec: 10_000_000_000,
    attackerSlowHashesPerSec: 2_000,
  });

  it("sizes the cores needed to hash at the login rate", () => {
    expect(result.hashCoresNeeded).toBe(1_250);
  });
  it("derives the peak number of concurrent hashes", () => {
    expect(result.peakConcurrentHashes).toBe(1_250);
  });
  it("derives the peak memory a memory-hard hash demands", () => {
    expect(result.peakHashMemoryMiB).toBe(80_000);
  });
  it("derives the attacker slowdown from a memory-hard hash", () => {
    expect(result.attackerSlowdownFactor).toBe(5_000_000);
  });
});
