export interface TlsCapacityAssumptions {
  /** New TLS connections established per second. */
  newConnectionsPerSec: number;
  /** CPU cost of a full (asymmetric) handshake, in milliseconds. */
  fullHandshakeCpuMs: number;
  /** CPU cost of a resumed handshake, in milliseconds. */
  resumedHandshakeCpuMs: number;
  /** Fraction of connections that resume a prior session (0–1). */
  resumptionRate: number;
  /** CPU milliseconds one core delivers per second (1000). */
  msPerCorePerSec: number;
}

export interface TlsCapacityResults {
  fullHandshakesPerSec: number;
  resumedHandshakesPerSec: number;
  handshakeCpuMsPerSec: number;
  coresWithResumption: number;
  coresWithoutResumption: number;
}

/**
 * Pure, deterministic capacity model. The lesson: the asymmetric TLS handshake is the expensive
 * part — bulk symmetric encryption of the actual bytes is cheap — so TLS termination is sized by
 * handshakes/sec, not throughput. Session resumption (a resumed handshake is ~20× cheaper here)
 * plus keep-alive amortize the cost: resuming 80% of connections cuts ~100 cores to ~24 (~4×),
 * which is why TLS is terminated at a shared, optimized edge.
 */
export function calculateTlsCapacity(a: TlsCapacityAssumptions): TlsCapacityResults {
  const resumedHandshakesPerSec = a.newConnectionsPerSec * a.resumptionRate;
  const fullHandshakesPerSec = a.newConnectionsPerSec - resumedHandshakesPerSec;
  const handshakeCpuMsPerSec =
    fullHandshakesPerSec * a.fullHandshakeCpuMs + resumedHandshakesPerSec * a.resumedHandshakeCpuMs;
  const coresWithResumption = Math.ceil(handshakeCpuMsPerSec / a.msPerCorePerSec);
  const coresWithoutResumption = Math.ceil(
    (a.newConnectionsPerSec * a.fullHandshakeCpuMs) / a.msPerCorePerSec,
  );

  return {
    fullHandshakesPerSec,
    resumedHandshakesPerSec,
    handshakeCpuMsPerSec,
    coresWithResumption,
    coresWithoutResumption,
  };
}
