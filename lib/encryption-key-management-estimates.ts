export interface EncryptionCapacityAssumptions {
  /** Encrypt/decrypt operations per second across the fleet. */
  operationsPerSec: number;
  /** Latency/cost of one KMS call to unwrap (decrypt) a data key, in milliseconds. */
  kmsUnwrapMs: number;
  /** Fraction of operations that reuse a cached plaintext data key (0–1). */
  dekCacheHitRate: number;
  /** CPU cost of encrypting one payload locally with AES, in milliseconds. */
  aesEncryptMs: number;
  /** CPU milliseconds one core delivers per second (1000). */
  msPerCorePerSec: number;
}

export interface EncryptionCapacityResults {
  naiveKmsCallsPerSec: number;
  cachedKmsCallsPerSec: number;
  kmsReductionFactor: number;
  localCryptoCores: number;
}

/**
 * Pure, deterministic capacity model. The lesson: the cipher isn't the cost — the KMS call is.
 * Unwrapping a data key on every operation would mean one KMS call per op, blowing past KMS quotas
 * and adding a network hop each time. Envelope encryption lets one DEK protect many objects, so
 * caching the plaintext DEK for a short window collapses KMS traffic: a 99.9% hit rate turns 500k
 * KMS calls/sec into 500 (~1,000×), while the actual AES work is a handful of nearly-free,
 * hardware-accelerated cores. Encryption is sized by KMS calls, not cipher throughput — traded
 * against the blast radius of a cached key.
 */
export function calculateEncryptionCapacity(
  a: EncryptionCapacityAssumptions,
): EncryptionCapacityResults {
  const naiveKmsCallsPerSec = a.operationsPerSec;
  const cachedKmsCallsPerSec = a.operationsPerSec - a.operationsPerSec * a.dekCacheHitRate;
  const kmsReductionFactor = naiveKmsCallsPerSec / cachedKmsCallsPerSec;
  const localCryptoCores = Math.ceil((a.operationsPerSec * a.aesEncryptMs) / a.msPerCorePerSec);

  return {
    naiveKmsCallsPerSec,
    cachedKmsCallsPerSec,
    kmsReductionFactor,
    localCryptoCores,
  };
}
