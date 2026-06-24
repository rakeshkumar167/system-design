const BYTES_PER_GB = 1_000_000_000;
const BYTES_PER_EB = 1_000_000_000_000_000_000;
const SECONDS_PER_DAY = 86_400;

export interface CloudDriveCapacityAssumptions {
  /** Total registered users. */
  totalUsers: number;
  /** Average stored bytes per user, in GB (pre-dedup). */
  avgStorageGbPerUser: number;
  /** Fraction of raw bytes removed by deduplication (0..1). */
  dedupRatio: number;
  /** Users active on a given day. */
  dailyActiveUsers: number;
  /** Average file edits (commits) per active user per day. */
  avgDailyEditsPerActiveUser: number;
  /** Average bytes in an edited file. */
  avgEditBytes: number;
  /** Fraction of an edited file's bytes actually transferred under delta sync (0..1). */
  deltaSyncFraction: number;
}

export interface CloudDriveCapacityResults {
  rawStorageEb: number;
  physicalStorageEb: number;
  metadataWritesPerSecond: number;
  naiveUploadGbPerSecond: number;
  deltaUploadGbPerSecond: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: raw storage is exabyte-scale
 * (so content belongs in object storage, not a database), deduplication removes a large
 * slice of it, metadata is tiny in bytes but high-QPS (a separate sharded store), and delta
 * sync cuts upload bandwidth by ~10× versus re-sending whole files.
 */
export function calculateCloudDriveCapacity(
  a: CloudDriveCapacityAssumptions,
): CloudDriveCapacityResults {
  const rawBytes = a.totalUsers * a.avgStorageGbPerUser * BYTES_PER_GB;
  const rawStorageEb = rawBytes / BYTES_PER_EB;
  const physicalStorageEb = rawStorageEb * (1 - a.dedupRatio);
  const metadataWritesPerSecond =
    (a.dailyActiveUsers * a.avgDailyEditsPerActiveUser) / SECONDS_PER_DAY;
  const naiveUploadGbPerSecond =
    (metadataWritesPerSecond * a.avgEditBytes) / BYTES_PER_GB;
  const deltaUploadGbPerSecond = naiveUploadGbPerSecond * a.deltaSyncFraction;

  return {
    rawStorageEb,
    physicalStorageEb,
    metadataWritesPerSecond,
    naiveUploadGbPerSecond,
    deltaUploadGbPerSecond,
  };
}
