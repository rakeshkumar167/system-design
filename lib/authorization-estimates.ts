export interface AuthorizationCapacityAssumptions {
  /** Application requests per second. */
  requestsPerSec: number;
  /** Authorization checks triggered per request (gateway + service + object level). */
  checksPerRequest: number;
  /** CPU cost of evaluating one uncached decision, in milliseconds. */
  decisionCpuMs: number;
  /** Fraction of checks served from the decision cache (0–1). */
  cacheHitRate: number;
  /** CPU milliseconds one core delivers per second (1000). */
  msPerCorePerSec: number;
}

export interface AuthorizationCapacityResults {
  totalChecksPerSec: number;
  cachedChecksPerSec: number;
  evaluatedChecksPerSec: number;
  decisionCpuMsPerSec: number;
  coresWithCache: number;
  coresWithoutCache: number;
}

/**
 * Pure, deterministic capacity model. The lesson: authorization runs on every request, often
 * several times (gateway, service, object level), so a busy API makes far more authz checks than
 * it serves requests. Fully evaluating every check is expensive; a decision cache — most checks
 * repeat the same subject/action/resource — amortizes it: a 90% hit rate turns 600k checks/sec
 * into 60k evaluations, cutting ~300 cores to ~30 (~10×). Authz is sized by checks/sec, and local
 * (sidecar) evaluation plus caching beat a network hop per check — traded against staleness.
 */
export function calculateAuthorizationCapacity(
  a: AuthorizationCapacityAssumptions,
): AuthorizationCapacityResults {
  const totalChecksPerSec = a.requestsPerSec * a.checksPerRequest;
  const cachedChecksPerSec = totalChecksPerSec * a.cacheHitRate;
  const evaluatedChecksPerSec = totalChecksPerSec - cachedChecksPerSec;
  const decisionCpuMsPerSec = evaluatedChecksPerSec * a.decisionCpuMs;
  const coresWithCache = Math.ceil(decisionCpuMsPerSec / a.msPerCorePerSec);
  const coresWithoutCache = Math.ceil((totalChecksPerSec * a.decisionCpuMs) / a.msPerCorePerSec);

  return {
    totalChecksPerSec,
    cachedChecksPerSec,
    evaluatedChecksPerSec,
    decisionCpuMsPerSec,
    coresWithCache,
    coresWithoutCache,
  };
}
