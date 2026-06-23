export interface RateLimiterCapacityAssumptions {
  /** Peak inbound requests per second across the fleet. */
  peakRequestsPerSecond: number;
  /** Limiter checks performed per request (usually 1; more with layered policies). */
  checksPerRequest: number;
  /** Distinct counter keys live in any window (the cardinality driver). */
  activeKeys: number;
  /** Bytes per counter entry, including key, value, and TTL overhead. */
  bytesPerCounter: number;
  /** Atomic counter ops a single Redis node sustains per second. */
  redisOpsPerNode: number;
}

export interface RateLimiterCapacityResults {
  counterOpsPerSecond: number;
  counterMemoryGB: number;
  redisNodesForOps: number;
}

/**
 * Pure, deterministic capacity model. Returns raw numeric values; formatting is
 * the presentation layer's job. Memory uses decimal GB (10^9 bytes), how cloud
 * memory is billed.
 */
export function calculateRateLimiterCapacity(
  a: RateLimiterCapacityAssumptions,
): RateLimiterCapacityResults {
  const counterOpsPerSecond = a.peakRequestsPerSecond * a.checksPerRequest;
  const counterMemoryGB = (a.activeKeys * a.bytesPerCounter) / 1e9;
  const redisNodesForOps = Math.ceil(counterOpsPerSecond / a.redisOpsPerNode);

  return { counterOpsPerSecond, counterMemoryGB, redisNodesForOps };
}
