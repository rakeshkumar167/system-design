const SECONDS_PER_DAY = 86_400;
const BYTES_PER_TB = 1_000_000_000_000;

export interface NewsFeedCapacityAssumptions {
  /** Daily active users who read their feed. */
  dailyActiveUsers: number;
  /** Total posts created per day across all users. */
  dailyPosts: number;
  /** Average followers per posting account (fan-out factor). */
  avgFollowers: number;
  /** Feed reads (opens/refreshes) per active user per day. */
  feedReadsPerUserPerDay: number;
  /** Entries kept in each user's precomputed feed. */
  feedLengthCached: number;
  /** Bytes per feed entry (post id + score + metadata). */
  bytesPerFeedEntry: number;
  /** Feed writes one fan-out worker sustains per second. */
  fanoutWritesPerSecPerWorker: number;
}

export interface NewsFeedCapacityResults {
  postsPerSec: number;
  fanoutWritesPerSec: number;
  feedReadsPerSec: number;
  fanoutWorkersNeeded: number;
  feedStorageTb: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: posting is modest (~5.8k posts/sec), but
 * fan-out-on-write multiplies every post by its author's follower count into ~1.74M feed writes/sec
 * (~300×), making the feed a write-heavy system — the price of precomputation that turns each read into
 * a single cache lookup. Feeds store only post IDs (~9.6 TB) hydrated from a post store, and the
 * amplification is why celebrities break pure push, forcing the hybrid model.
 */
export function calculateNewsFeedCapacity(
  a: NewsFeedCapacityAssumptions,
): NewsFeedCapacityResults {
  const postsPerSec = a.dailyPosts / SECONDS_PER_DAY;
  const fanoutWritesPerSec = (a.dailyPosts * a.avgFollowers) / SECONDS_PER_DAY;
  const feedReadsPerSec = (a.dailyActiveUsers * a.feedReadsPerUserPerDay) / SECONDS_PER_DAY;
  const fanoutWorkersNeeded = Math.ceil(fanoutWritesPerSec / a.fanoutWritesPerSecPerWorker);
  const feedStorageTb =
    (a.dailyActiveUsers * a.feedLengthCached * a.bytesPerFeedEntry) / BYTES_PER_TB;

  return {
    postsPerSec,
    fanoutWritesPerSec,
    feedReadsPerSec,
    fanoutWorkersNeeded,
    feedStorageTb,
  };
}
