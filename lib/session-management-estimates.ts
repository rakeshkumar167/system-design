export interface SessionCapacityAssumptions {
  /** Authenticated requests per second (each needs a session lookup if stateful). */
  requestsPerSec: number;
  /** Number of active sessions held at once. */
  activeSessions: number;
  /** Bytes of state stored per session. */
  sessionBytes: number;
  /** Fraction of lookups served from a session cache in front of the store (0–1). */
  cacheHitRate: number;
  /** Bytes per gigabyte (1_000_000_000) — decimal GB. */
  bytesPerGb: number;
}

export interface SessionCapacityResults {
  storeLookupsWithoutCache: number;
  storeLookupsWithCache: number;
  lookupReductionFactor: number;
  sessionStoreMemoryGb: number;
}

/**
 * Pure, deterministic capacity model. The lesson: stateful sessions cost a store lookup on every
 * authenticated request plus the memory to hold every active session. At 300k req/s that's 300,000
 * lookups/sec against the session store and 50 GB for 50M sessions; a 95%-hit session cache cuts
 * store lookups 20× to 15,000/sec. That's the session-storage trade in numbers: stateful buys instant
 * revocation but pays a per-request lookup + memory (softened by caching), while stateless (signed
 * cookie/JWT) pays no lookup and scales trivially but can't revoke a session before it expires.
 */
export function calculateSessionCapacity(
  a: SessionCapacityAssumptions,
): SessionCapacityResults {
  const storeLookupsWithoutCache = a.requestsPerSec;
  const storeLookupsWithCache = a.requestsPerSec - a.requestsPerSec * a.cacheHitRate;
  const lookupReductionFactor = storeLookupsWithoutCache / storeLookupsWithCache;
  const sessionStoreMemoryGb = (a.activeSessions * a.sessionBytes) / a.bytesPerGb;

  return {
    storeLookupsWithoutCache,
    storeLookupsWithCache,
    lookupReductionFactor,
    sessionStoreMemoryGb,
  };
}
