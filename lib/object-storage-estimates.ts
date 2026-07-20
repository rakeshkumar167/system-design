const BYTES_PER_PB = 1_000_000_000_000_000;

export interface ObjectStorageCapacityAssumptions {
  /** Total number of stored objects. */
  objectsStored: number;
  /** Average object size in bytes. */
  avgObjectBytes: number;
  /** Erasure-coding data shards (k). */
  dataShards: number;
  /** Erasure-coding parity shards (m). */
  parityShards: number;
  /** Replication factor to compare against. */
  replicationFactor: number;
}

export interface ObjectStorageCapacityResults {
  logicalDataPb: number;
  erasureStoredPb: number;
  replicationStoredPb: number;
  storageSavedPb: number;
  fragmentFailuresTolerated: number;
}

/**
 * Pure, deterministic capacity model. The lesson: at exabyte scale, durability comes from erasure
 * coding, not replication. Storing 1 EB with 8+4 Reed-Solomon uses 1.5 EB of raw capacity (1.5×
 * overhead) and survives any 4 simultaneous fragment losses, versus 3× replication needing 3 EB for
 * comparable durability — halving the storage bill (~1500 PB saved) at the cost of encode/decode CPU and
 * reconstruction on degraded reads. Metadata is tiny by bytes but enormous by object count (a trillion
 * keys), which is why it's sharded and kept separate from the data plane.
 */
export function calculateObjectStorageCapacity(
  a: ObjectStorageCapacityAssumptions,
): ObjectStorageCapacityResults {
  const logicalDataPb = (a.objectsStored * a.avgObjectBytes) / BYTES_PER_PB;
  const erasureOverhead = (a.dataShards + a.parityShards) / a.dataShards;
  const erasureStoredPb = logicalDataPb * erasureOverhead;
  const replicationStoredPb = logicalDataPb * a.replicationFactor;
  const storageSavedPb = replicationStoredPb - erasureStoredPb;
  const fragmentFailuresTolerated = a.parityShards;

  return {
    logicalDataPb,
    erasureStoredPb,
    replicationStoredPb,
    storageSavedPb,
    fragmentFailuresTolerated,
  };
}
