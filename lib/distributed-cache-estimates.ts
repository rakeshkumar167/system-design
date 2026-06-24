const BYTES_PER_GB = 1_000_000_000;
const BYTES_PER_TB = 1_000_000_000_000;

export interface DistributedCacheCapacityAssumptions {
  /** Total distinct items in the backing store. */
  totalItems: number;
  /** Average serialized size of one item, in bytes. */
  avgItemBytes: number;
  /** Fraction of the dataset kept hot in cache (the working set). */
  cacheableFraction: number;
  /** RAM available for cache data per node, in GB. */
  memoryPerNodeGb: number;
  /** Peak read requests per second hitting the cache. */
  peakReadsPerSecond: number;
  /** Fraction of reads served from cache (0..1). */
  hitRatio: number;
}

export interface DistributedCacheCapacityResults {
  totalDatasetTb: number;
  workingSetGb: number;
  nodesNeeded: number;
  backingStoreReadsPerSecond: number;
  readsPerNodePerSecond: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: a cache holds only a
 * fraction of the dataset (so eviction quality decides the hit ratio), node count comes
 * from memory, and a high hit ratio is the whole point — it shields the slow backing
 * store from the bulk of reads.
 */
export function calculateDistributedCacheCapacity(
  a: DistributedCacheCapacityAssumptions,
): DistributedCacheCapacityResults {
  const totalBytes = a.totalItems * a.avgItemBytes;
  const totalDatasetTb = totalBytes / BYTES_PER_TB;
  const workingSetGb = (totalBytes * a.cacheableFraction) / BYTES_PER_GB;
  const nodesNeeded = Math.ceil(workingSetGb / a.memoryPerNodeGb);
  const backingStoreReadsPerSecond = a.peakReadsPerSecond * (1 - a.hitRatio);
  const readsPerNodePerSecond = a.peakReadsPerSecond / nodesNeeded;

  return {
    totalDatasetTb,
    workingSetGb,
    nodesNeeded,
    backingStoreReadsPerSecond,
    readsPerNodePerSecond,
  };
}
