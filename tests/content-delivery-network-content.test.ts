import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/tutorials/content-delivery-network.mdx", "utf8");

const requiredIds = [
  "interview-framing",
  "requirements",
  "capacity-estimates",
  "entity-model",
  "api-design",
  "high-level-architecture",
  "detailed-flows",
  "request-routing",
  "edge-cache",
  "origin-offload",
  "cache-invalidation",
  "dynamic-edge",
  "edge-security",
  "scalability-evolution",
  "resiliency-failure-modes",
  "tradeoffs-alternatives",
  "interview-summary",
  "knowledge-checks-faq",
];

describe("Content Delivery Network tutorial content", () => {
  it("contains all eighteen required section anchors", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the capacity model, architecture, and all four flow diagrams", () => {
    for (const tag of [
      "<CdnCapacity",
      "<CdnArchitecture",
      "<EdgeRequestRoutingSequence",
      "<EdgeCacheLookupSequence",
      "<OriginShieldSequence",
      "<CacheInvalidationSequence",
    ]) {
      expect(content).toContain(tag);
    }
  });

  it("embeds capacity assumptions matching the estimates test", () => {
    expect(content).toContain("dailyRequests: 1728000000000");
    expect(content).toContain("cacheHitPercent: 95");
    expect(content).toContain("improvedHitPercent: 99");
    expect(content).toContain("avgObjectBytes: 100000");
  });

  it("includes at least six knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("includes at least twelve FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(12);
  });
});
