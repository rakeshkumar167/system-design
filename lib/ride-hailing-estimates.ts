const SECONDS_PER_DAY = 86_400;

export interface RideHailingCapacityAssumptions {
  /** Active drivers sharing their location. */
  activeDrivers: number;
  /** Seconds between a driver's GPS pings. */
  pingIntervalSec: number;
  /** Bytes per location update. */
  locationBytes: number;
  /** Ride requests per day. */
  ridesPerDay: number;
  /** Candidate drivers evaluated per match. */
  candidatesPerMatch: number;
}

export interface RideHailingCapacityResults {
  locationUpdatesPerSec: number;
  locationWriteMbPerSec: number;
  ridesPerSec: number;
  writeToRequestRatio: number;
  candidateEvaluationsPerSec: number;
}

/**
 * Pure, deterministic capacity model. The lesson: ride-hailing is dominated by a location-update
 * firehose. Five million drivers pinging every 4s is 1.25M writes/sec (~125 MB/s), about 2160× the
 * actual ride-request rate (~579/s). So driver location must be in-memory and ephemeral — keep only each
 * driver's latest position in a geospatial index and overwrite it, never durably persisting every ping.
 * Matching is comparatively cheap: each request is a geo query plus ranking ~10 candidates (~5.8k
 * evaluations/sec). Cheaply absorb an enormous location write stream into a live geo-index against which
 * relatively rare matching queries run.
 */
export function calculateRideHailingCapacity(
  a: RideHailingCapacityAssumptions,
): RideHailingCapacityResults {
  const locationUpdatesPerSec = a.activeDrivers / a.pingIntervalSec;
  const locationWriteMbPerSec = (locationUpdatesPerSec * a.locationBytes) / 1_000_000;
  const ridesPerSec = a.ridesPerDay / SECONDS_PER_DAY;
  const writeToRequestRatio = locationUpdatesPerSec / ridesPerSec;
  const candidateEvaluationsPerSec = ridesPerSec * a.candidatesPerMatch;

  return {
    locationUpdatesPerSec,
    locationWriteMbPerSec,
    ridesPerSec,
    writeToRequestRatio,
    candidateEvaluationsPerSec,
  };
}
