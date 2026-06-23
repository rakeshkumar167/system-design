import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/tutorials/rate-limiter.mdx", "utf8");

const requiredIds = [
  "interview-framing", "requirements", "limit-policies", "algorithms",
  "capacity-estimates", "api-design", "high-level-architecture",
  "distributed-counting", "consistency-races", "scalability-evolution",
  "resiliency-failure-modes", "observability", "tradeoffs-alternatives",
  "interview-summary", "knowledge-checks-faq",
];

describe("Rate Limiter content", () => {
  it("contains every required section anchor", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the visualizer, capacity model, and architecture diagram", () => {
    for (const tag of [
      "<RateLimitVisualizer",
      "<RateLimiterCapacity",
      "<RateLimiterArchitecture",
    ]) {
      expect(content).toContain(tag);
    }
  });

  it("embeds the flow sequence diagrams", () => {
    for (const tag of ["<AllowSequence", "<ThrottleSequence", "<FailOpenSequence"]) {
      expect(content).toContain(tag);
    }
  });

  it("includes at least six knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("includes at least twelve FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(12);
  });
});
