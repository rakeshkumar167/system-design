import { describe, it, expect } from "vitest";
import { calculateLeaderboardCapacity } from "@/lib/leaderboard-estimates";

describe("calculateLeaderboardCapacity", () => {
  const result = calculateLeaderboardCapacity({
    players: 50_000_000,
    bytesPerEntry: 100,
    scoreUpdatesPerDay: 5_000_000_000,
    readsPerUpdate: 10,
    opsPerNode: 100_000,
  });

  it("derives the score-update QPS", () => {
    expect(result.updateQps).toBeCloseTo(57_870.37, 1);
  });
  it("derives the read QPS (reads dominate)", () => {
    expect(result.readQps).toBeCloseTo(578_703.7, 1);
  });
  it("derives the total sorted-set ops QPS", () => {
    expect(result.totalOpsQps).toBeCloseTo(636_574.07, 1);
  });
  it("derives the in-RAM memory for the ranked set", () => {
    expect(result.leaderboardMemoryGb).toBe(5);
  });
  it("sizes the fleet by throughput, not storage", () => {
    expect(result.nodesForThroughput).toBe(7);
  });
});
