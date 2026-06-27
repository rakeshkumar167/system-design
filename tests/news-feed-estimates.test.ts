import { describe, it, expect } from "vitest";
import { calculateNewsFeedCapacity } from "@/lib/news-feed-estimates";

describe("calculateNewsFeedCapacity", () => {
  const result = calculateNewsFeedCapacity({
    dailyActiveUsers: 300_000_000,
    dailyPosts: 500_000_000,
    avgFollowers: 300,
    feedReadsPerUserPerDay: 50,
    feedLengthCached: 1_000,
    bytesPerFeedEntry: 32,
    fanoutWritesPerSecPerWorker: 10_000,
  });

  it("derives posts per second", () => {
    expect(result.postsPerSec).toBeCloseTo(5787.04, 1);
  });
  it("derives the fan-out write rate per second", () => {
    expect(result.fanoutWritesPerSec).toBeCloseTo(1736111.11, 1);
  });
  it("derives feed reads per second", () => {
    expect(result.feedReadsPerSec).toBeCloseTo(173611.11, 1);
  });
  it("derives the fan-out worker fleet size", () => {
    expect(result.fanoutWorkersNeeded).toBe(174);
  });
  it("derives feed storage in TB", () => {
    expect(result.feedStorageTb).toBe(9.6);
  });
});
