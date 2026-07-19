export interface PasswordHashingCapacityAssumptions {
  /** Successful+attempted logins per second (each triggers one password hash). */
  loginsPerSec: number;
  /** Wall/CPU time to compute one hash at the tuned work factor, in milliseconds. */
  hashCostMs: number;
  /** Memory a single memory-hard hash computation uses, in MiB. */
  hashMemoryMiB: number;
  /** CPU milliseconds one core delivers per second (1000). */
  msPerCorePerSec: number;
  /** Guesses/sec a GPU manages against a fast general-purpose hash (e.g. SHA-256). */
  attackerFastHashesPerSec: number;
  /** Guesses/sec the same GPU manages against the tuned memory-hard hash. */
  attackerSlowHashesPerSec: number;
}

export interface PasswordHashingCapacityResults {
  hashCoresNeeded: number;
  peakConcurrentHashes: number;
  peakHashMemoryMiB: number;
  attackerSlowdownFactor: number;
}

/**
 * Pure, deterministic capacity model. The lesson: password hashing is the one place slowness is a
 * feature. A hash tuned to ~250 ms costs almost nothing once per login but is ruinous across an
 * attacker's billions of offline guesses. Sizing for the login rate makes the server cost real —
 * ~1,250 cores and ~80 GiB of RAM for a memory-hard hash at 5,000 logins/s — which is why you hash
 * only at login and rate-limit it. The same cost multiplies the attacker's work: a fast hash gives a
 * GPU ~10 billion guesses/sec, the memory-hard hash ~2,000/sec — a 5,000,000× slowdown.
 */
export function calculatePasswordHashingCapacity(
  a: PasswordHashingCapacityAssumptions,
): PasswordHashingCapacityResults {
  const hashDurationSec = a.hashCostMs / a.msPerCorePerSec;
  const hashCoresNeeded = Math.ceil((a.loginsPerSec * a.hashCostMs) / a.msPerCorePerSec);
  const peakConcurrentHashes = a.loginsPerSec * hashDurationSec;
  const peakHashMemoryMiB = peakConcurrentHashes * a.hashMemoryMiB;
  const attackerSlowdownFactor = a.attackerFastHashesPerSec / a.attackerSlowHashesPerSec;

  return {
    hashCoresNeeded,
    peakConcurrentHashes,
    peakHashMemoryMiB,
    attackerSlowdownFactor,
  };
}
