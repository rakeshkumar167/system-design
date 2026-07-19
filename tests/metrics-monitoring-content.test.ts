import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/tutorials/metrics-monitoring.mdx", "utf8");

const requiredIds = [
  "interview-framing",
  "requirements",
  "capacity-estimates",
  "entity-model",
  "api-design",
  "high-level-architecture",
  "detailed-flows",
  "data-model-cardinality",
  "ingestion-pipeline",
  "tsdb-storage",
  "downsampling-retention",
  "query-aggregation",
  "alerting",
  "scalability-evolution",
  "resiliency-failure-modes",
  "tradeoffs-alternatives",
  "interview-summary",
  "knowledge-checks-faq",
];

describe("Metrics and Monitoring tutorial content", () => {
  it("contains all eighteen required section anchors", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the capacity model, architecture, and all four flow diagrams", () => {
    for (const tag of [
      "<MetricsCapacity",
      "<MetricsArchitecture",
      "<IngestSampleSequence",
      "<RangeQuerySequence",
      "<AlertEvaluationSequence",
      "<DownsampleRetentionSequence",
    ]) {
      expect(content).toContain(tag);
    }
  });

  it("embeds capacity assumptions matching the estimates test", () => {
    expect(content).toContain("monitoredTargets: 1000000");
    expect(content).toContain("seriesPerTarget: 200");
    expect(content).toContain("scrapeIntervalSec: 10");
    expect(content).toContain("rawBytesPerSample: 16");
    expect(content).toContain("compressedBytesPerSample: 2");
  });

  it("includes at least six knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("includes at least twelve FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(12);
  });
});
