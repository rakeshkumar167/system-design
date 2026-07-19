export interface ApiSecurityCapacityAssumptions {
  /** Total API requests per second hitting the edge. */
  requestsPerSec: number;
  /** Fraction of traffic that is abusive/unauthenticated and can be rejected at the edge (0–1). */
  abusiveFraction: number;
  /** CPU to authenticate + rate-limit-check one request at the gateway, in milliseconds. */
  gatewayCheckCpuMs: number;
  /** CPU to actually serve one request in the backend, in milliseconds. */
  backendCpuMs: number;
  /** CPU milliseconds one core delivers per second (1000). */
  msPerCorePerSec: number;
}

export interface ApiSecurityCapacityResults {
  gatewaySecurityCores: number;
  backendCoresWithoutFiltering: number;
  backendCoresWithFiltering: number;
  netCoresSaved: number;
}

/**
 * Pure, deterministic capacity model. The lesson: securing every request costs something, but the
 * cheap edge check pays for itself. Verifying a token and checking a rate limit is a small tax (~50
 * cores at 200k req/s); the payoff is rejecting abusive/unauthenticated traffic before it reaches the
 * expensive backend. If half the traffic is abusive, serving it all would need 1,000 backend cores;
 * filtering it at the gateway drops that to 500, so even after the gateway's own cost you net ~450
 * cores saved. Edge security is a capacity optimization — while object-level authorization stays in
 * the service (defense in depth).
 */
export function calculateApiSecurityCapacity(
  a: ApiSecurityCapacityAssumptions,
): ApiSecurityCapacityResults {
  const gatewaySecurityCores = Math.ceil((a.requestsPerSec * a.gatewayCheckCpuMs) / a.msPerCorePerSec);
  const backendCoresWithoutFiltering = Math.ceil((a.requestsPerSec * a.backendCpuMs) / a.msPerCorePerSec);
  const legitRequestsPerSec = a.requestsPerSec * (1 - a.abusiveFraction);
  const backendCoresWithFiltering = Math.ceil((legitRequestsPerSec * a.backendCpuMs) / a.msPerCorePerSec);
  const netCoresSaved = backendCoresWithoutFiltering - (gatewaySecurityCores + backendCoresWithFiltering);

  return {
    gatewaySecurityCores,
    backendCoresWithoutFiltering,
    backendCoresWithFiltering,
    netCoresSaved,
  };
}
