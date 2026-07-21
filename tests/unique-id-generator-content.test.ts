import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/tutorials/unique-id-generator.mdx", "utf8");

const requiredIds = [
  "interview-framing",
  "requirements",
  "capacity-estimates",
  "entity-model",
  "api-design",
  "high-level-architecture",
  "detailed-flows",
  "id-approaches",
  "snowflake-anatomy",
  "worker-id-assignment",
  "clock-skew",
  "monotonicity-ordering",
  "throughput-scaling",
  "scalability-evolution",
  "resiliency-failure-modes",
  "tradeoffs-alternatives",
  "interview-summary",
  "knowledge-checks-faq",
];

describe("Unique ID Generator tutorial content", () => {
  it("contains all eighteen required section anchors", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the capacity model, architecture, and all four flow diagrams", () => {
    for (const tag of [
      "<SnowflakeCapacity",
      "<SnowflakeArchitecture",
      "<GenerateIdSequence",
      "<WorkerIdAssignmentSequence",
      "<ClockSkewSequence",
      "<SequenceOverflowSequence",
    ]) {
      expect(content).toContain(tag);
    }
  });

  it("embeds capacity assumptions matching the estimates test", () => {
    expect(content).toContain("timeBits: 41");
    expect(content).toContain("machineBits: 10");
    expect(content).toContain("sequenceBits: 12");
    expect(content).toContain("peakIdsPerSec: 1000000");
  });

  it("includes at least six knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("includes at least twelve FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(12);
  });
});
