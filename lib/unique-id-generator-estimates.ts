const MS_PER_YEAR = 365 * 86_400 * 1_000;

export interface SnowflakeCapacityAssumptions {
  /** Bits allocated to the timestamp (ms since a custom epoch). */
  timeBits: number;
  /** Bits allocated to the machine / worker id. */
  machineBits: number;
  /** Bits allocated to the per-millisecond sequence counter. */
  sequenceBits: number;
  /** A demanding target ID-generation rate to size against. */
  peakIdsPerSec: number;
}

export interface SnowflakeCapacityResults {
  totalBits: number;
  idsPerMsPerNode: number;
  idsPerSecPerNode: number;
  maxNodes: number;
  maxIdsPerSec: number;
  lifespanYears: number;
  nodesForPeakDemand: number;
}

/**
 * Pure, deterministic capacity model. The lesson: for a unique-ID generator, throughput is a non-problem
 * and the real budget is bits. One node mints 4,096,000 IDs/sec locally (12 sequence bits -> 4,096 per ms,
 * x1000 ms) with no network call and no coordination, so even a 1,000,000 IDs/sec workload needs a single
 * machine. The fixed 64 bits split into 41 time (~69.7-year lifespan), 10 machine (1,024 nodes), and 12
 * sequence (4,096 IDs/ms/node); filling all nodes gives ~4.19 billion IDs/sec. You don't scale for
 * throughput -- you budget bits for lifespan, node count, and per-node rate, and spend engineering on
 * clock and machine-id correctness.
 */
export function calculateSnowflakeCapacity(
  a: SnowflakeCapacityAssumptions,
): SnowflakeCapacityResults {
  const totalBits = 1 + a.timeBits + a.machineBits + a.sequenceBits;
  const idsPerMsPerNode = Math.pow(2, a.sequenceBits);
  const idsPerSecPerNode = idsPerMsPerNode * 1000;
  const maxNodes = Math.pow(2, a.machineBits);
  const maxIdsPerSec = idsPerSecPerNode * maxNodes;
  const lifespanYears = Math.pow(2, a.timeBits) / MS_PER_YEAR;
  const nodesForPeakDemand = Math.ceil(a.peakIdsPerSec / idsPerSecPerNode);

  return {
    totalBits,
    idsPerMsPerNode,
    idsPerSecPerNode,
    maxNodes,
    maxIdsPerSec,
    lifespanYears,
    nodesForPeakDemand,
  };
}
