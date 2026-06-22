import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync(
  "content/tutorials/url-shortener.mdx",
  "utf8",
);

const requiredIds = [
  "interview-framing",
  "requirements",
  "capacity-estimates",
  "entity-model",
  "api-design",
  "key-generation",
  "high-level-architecture",
  "detailed-flows",
  "storage-partitioning",
  "caching",
  "consistency-concurrency",
  "scalability-evolution",
  "resiliency-failure-modes",
  "security-abuse",
  "observability",
  "tradeoffs-alternatives",
  "interview-summary",
  "knowledge-checks-faq",
];

describe("URL Shortener content", () => {
  it("contains every required section anchor", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the architecture and key flow diagrams", () => {
    for (const tag of [
      "<ArchitectureDiagram",
      "<CreateUrlSequence",
      "<RedirectCacheHitSequence",
      "<RedirectCacheMissSequence",
      "<AnalyticsSequence",
      "<ScaleEvolution",
    ]) {
      expect(content).toContain(tag);
    }
  });

  it("includes at least six knowledge checks", () => {
    const matches = content.match(/<KnowledgeCheck/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(6);
  });

  it("includes at least twelve FAQ questions", () => {
    const matches = content.match(/question:/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(12);
  });
});
