const SECONDS_PER_DAY = 86_400;

export interface AuthenticationCapacityAssumptions {
  /** Daily active users. */
  dailyActiveUsers: number;
  /** Authenticated requests one user makes per day. */
  authedRequestsPerUserPerDay: number;
  /** Peak-to-average traffic ratio. */
  peakMultiplier: number;
  /** Reads/sec a single session-store node sustains. */
  sessionStoreReadsPerNode: number;
}

export interface AuthenticationCapacityResults {
  avgRequestsPerSec: number;
  peakRequestsPerSec: number;
  /** Stateful: one central session-store read per authenticated request. */
  statefulSessionReadsPerSec: number;
  statefulSessionStoreNodes: number;
  /** Stateless: signature verification is local CPU — no central read. */
  statelessVerifyReadsPerSec: number;
}

/**
 * Pure, deterministic capacity model. The lesson: every authenticated request must verify
 * identity. Stateful sessions turn that into a central session-store read on the hot path of
 * EVERY request (~347k reads/sec at peak ⇒ ~7 store nodes to keep available); stateless tokens
 * make it a local signature check (0 central reads). That is why tokens scale — and, because a
 * self-contained token can't be deleted, why revocation is hard.
 */
export function calculateAuthenticationCapacity(
  a: AuthenticationCapacityAssumptions,
): AuthenticationCapacityResults {
  const avgRequestsPerSec = (a.dailyActiveUsers * a.authedRequestsPerUserPerDay) / SECONDS_PER_DAY;
  const peakRequestsPerSec = avgRequestsPerSec * a.peakMultiplier;
  const statefulSessionReadsPerSec = peakRequestsPerSec;
  const statefulSessionStoreNodes = Math.ceil(statefulSessionReadsPerSec / a.sessionStoreReadsPerNode);
  const statelessVerifyReadsPerSec = 0;

  return {
    avgRequestsPerSec,
    peakRequestsPerSec,
    statefulSessionReadsPerSec,
    statefulSessionStoreNodes,
    statelessVerifyReadsPerSec,
  };
}
