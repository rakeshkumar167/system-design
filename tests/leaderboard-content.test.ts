import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/tutorials/leaderboard.mdx", "utf8");

const requiredIds = [
  "interview-framing",
  "requirements",
  "capacity-estimates",
  "entity-model",
  "api-design",
  "high-level-architecture",
  "detailed-flows",
  "sorted-sets",
  "score-updates",
  "rank-queries",
  "sharding-scale",
  "time-windows",
  "persistence-truth",
  "scalability-evolution",
  "resiliency-failure-modes",
  "tradeoffs-alternatives",
  "interview-summary",
  "knowledge-checks-faq",
];

describe("Leaderboard tutorial content", () => {
  it("contains all eighteen required section anchors", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the capacity model, architecture, and all four flow diagrams", () => {
    for (const tag of [
      "<LeaderboardCapacity",
      "<LeaderboardArchitecture",
      "<SubmitScoreSequence",
      "<TopKQuerySequence",
      "<PlayerRankSequence",
      "<ShardedRankSequence",
    ]) {
      expect(content).toContain(tag);
    }
  });

  it("embeds capacity assumptions matching the estimates test", () => {
    expect(content).toContain("players: 50000000");
    expect(content).toContain("bytesPerEntry: 100");
    expect(content).toContain("scoreUpdatesPerDay: 5000000000");
    expect(content).toContain("readsPerUpdate: 10");
    expect(content).toContain("opsPerNode: 100000");
  });

  it("includes at least six knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("includes at least twelve FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(12);
  });
});
