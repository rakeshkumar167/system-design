const SECONDS_PER_DAY = 86_400;

export interface ApiGatewayCapacityAssumptions {
  /** Total requests per day across all fronted services. */
  requestsPerDay: number;
  /** Peak-to-average traffic multiplier. */
  peakFactor: number;
  /** Latency the gateway's filter chain adds per request, in ms. */
  gatewayOverheadMs: number;
  /** Average backend processing latency, in ms. */
  avgBackendLatencyMs: number;
  /** Requests per second one gateway instance can handle. */
  instanceCapacityRps: number;
  /** Fraction of auth checks served from the local token cache. */
  authCacheHitRate: number;
  /** Latency of a central auth-store (introspection) lookup on a miss, in ms. */
  authStoreLatencyMs: number;
}

export interface ApiGatewayCapacityResults {
  avgRps: number;
  peakRps: number;
  instancesNeeded: number;
  latencyOverheadPct: number;
  effectiveAuthLatencyMs: number;
  authStoreQps: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: the gateway sees the sum of all
 * traffic and sits on every request's critical path, so its overhead must stay a small fraction of
 * total latency; being stateless it scales horizontally (peak ÷ per-instance capacity); and caching
 * auth/limit state keeps per-request cost tiny and offloads the central auth store ~20×.
 */
export function calculateApiGatewayCapacity(
  a: ApiGatewayCapacityAssumptions,
): ApiGatewayCapacityResults {
  const avgRps = a.requestsPerDay / SECONDS_PER_DAY;
  const peakRps = avgRps * a.peakFactor;
  const instancesNeeded = Math.ceil(peakRps / a.instanceCapacityRps);
  const latencyOverheadPct =
    (a.gatewayOverheadMs / (a.gatewayOverheadMs + a.avgBackendLatencyMs)) * 100;
  const effectiveAuthLatencyMs = (1 - a.authCacheHitRate) * a.authStoreLatencyMs;
  const authStoreQps = peakRps * (1 - a.authCacheHitRate);

  return {
    avgRps,
    peakRps,
    instancesNeeded,
    latencyOverheadPct,
    effectiveAuthLatencyMs,
    authStoreQps,
  };
}
