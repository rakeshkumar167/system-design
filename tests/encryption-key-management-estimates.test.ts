import { describe, it, expect } from "vitest";
import { calculateEncryptionCapacity } from "@/lib/encryption-key-management-estimates";

describe("calculateEncryptionCapacity", () => {
  const result = calculateEncryptionCapacity({
    operationsPerSec: 500_000,
    kmsUnwrapMs: 20,
    dekCacheHitRate: 0.999,
    aesEncryptMs: 0.01,
    msPerCorePerSec: 1_000,
  });

  it("derives the naive one-KMS-call-per-operation rate", () => {
    expect(result.naiveKmsCallsPerSec).toBe(500_000);
  });
  it("derives the KMS call rate with a DEK cache", () => {
    expect(result.cachedKmsCallsPerSec).toBe(500);
  });
  it("derives the KMS-call reduction factor from caching data keys", () => {
    expect(result.kmsReductionFactor).toBe(1_000);
  });
  it("sizes the near-free local AES compute", () => {
    expect(result.localCryptoCores).toBe(5);
  });
});
