const SECONDS_PER_DAY = 86_400;

export interface CdnCapacityAssumptions {
  /** Total requests hitting the CDN edge per day. */
  dailyRequests: number;
  /** Cache-hit ratio as an integer percent (e.g. 95 = 95%). */
  cacheHitPercent: number;
  /** A higher hit ratio to contrast, integer percent (e.g. 99). */
  improvedHitPercent: number;
  /** Average object size in bytes. */
  avgObjectBytes: number;
}

export interface CdnCapacityResults {
  edgeRequestsPerSec: number;
  originRequestsPerSec: number;
  offloadFactor: number;
  originRequestsAtImprovedHitRatio: number;
  originReductionFactor: number;
  edgeEgressGbPerSec: number;
  originEgressGbPerSec: number;
}

/**
 * Pure, deterministic capacity model. The lesson: a CDN's whole point is origin offload, and the
 * cache-hit ratio is the master lever — non-linearly. At 20M edge requests/sec and a 95% hit ratio the
 * origin sees only 1M requests/sec (a 20x reduction) and supplies 100 GB/s instead of the 2000 GB/s the
 * edge serves. Raising the hit ratio 95% -> 99% cuts origin load another 5x (1M -> 200k), because origin
 * traffic scales with the miss ratio (5% -> 1% is a fifth). Every fraction of a percent of hits is worth
 * far more at the origin than it looks, which is why the design obsesses over cache-key hygiene, long
 * TTLs, immutable URLs, and an origin shield.
 */
export function calculateCdnCapacity(a: CdnCapacityAssumptions): CdnCapacityResults {
  const edgeRequestsPerSec = a.dailyRequests / SECONDS_PER_DAY;
  const missPercent = 100 - a.cacheHitPercent;
  const improvedMissPercent = 100 - a.improvedHitPercent;
  const originRequestsPerSec = (edgeRequestsPerSec * missPercent) / 100;
  const offloadFactor = 100 / missPercent;
  const originRequestsAtImprovedHitRatio = (edgeRequestsPerSec * improvedMissPercent) / 100;
  const originReductionFactor = originRequestsPerSec / originRequestsAtImprovedHitRatio;
  const edgeEgressGbPerSec = (edgeRequestsPerSec * a.avgObjectBytes) / 1_000_000_000;
  const originEgressGbPerSec = (originRequestsPerSec * a.avgObjectBytes) / 1_000_000_000;

  return {
    edgeRequestsPerSec,
    originRequestsPerSec,
    offloadFactor,
    originRequestsAtImprovedHitRatio,
    originReductionFactor,
    edgeEgressGbPerSec,
    originEgressGbPerSec,
  };
}
