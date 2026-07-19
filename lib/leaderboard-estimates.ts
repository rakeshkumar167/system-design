const SECONDS_PER_DAY = 86_400;
const BYTES_PER_GB = 1_000_000_000;

export interface LeaderboardCapacityAssumptions {
  /** Number of players held in the ranked sorted set. */
  players: number;
  /** Bytes to store one entry (member id + score + skip-list overhead). */
  bytesPerEntry: number;
  /** Score updates (submissions/increments) per day. */
  scoreUpdatesPerDay: number;
  /** Read queries (top-K + rank lookups) issued per score update. */
  readsPerUpdate: number;
  /** Sorted-set operations one in-memory node sustains per second. */
  opsPerNode: number;
}

export interface LeaderboardCapacityResults {
  updateQps: number;
  readQps: number;
  totalOpsQps: number;
  leaderboardMemoryGb: number;
  nodesForThroughput: number;
}

/**
 * Pure, deterministic capacity model. The lesson: a 50M-player board is only ~5 GB, so it fits
 * comfortably in RAM — storage is never the constraint. Because sorted-set operations are O(log N), a
 * single node sustains ~100k ops/sec, so the system is sized by throughput (reads dominate ~10:1), not
 * data volume — a handful of replicated in-memory nodes carry it. The interesting scaling problems are
 * hot boards, cross-shard global rank, and time-window fan-out, not raw storage.
 */
export function calculateLeaderboardCapacity(
  a: LeaderboardCapacityAssumptions,
): LeaderboardCapacityResults {
  const updateQps = a.scoreUpdatesPerDay / SECONDS_PER_DAY;
  const readQps = updateQps * a.readsPerUpdate;
  const totalOpsQps = updateQps + readQps;
  const leaderboardMemoryGb = (a.players * a.bytesPerEntry) / BYTES_PER_GB;
  const nodesForThroughput = Math.ceil(totalOpsQps / a.opsPerNode);

  return {
    updateQps,
    readQps,
    totalOpsQps,
    leaderboardMemoryGb,
    nodesForThroughput,
  };
}
