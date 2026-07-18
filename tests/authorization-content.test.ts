import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/topics/authorization.mdx", "utf8");

const requiredIds = [
  "overview",
  "access-control-models",
  "rbac",
  "abac",
  "policy-architecture",
  "capacity-estimates",
  "relationship-based",
  "enforcement-in-practice",
  "pitfalls-best-practices",
  "knowledge-checks-faq",
];

describe("Authorization topic content", () => {
  it("contains every required section anchor", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the capacity model and both flow diagrams", () => {
    for (const tag of [
      "<AuthorizationCapacity",
      "<AuthorizationDecisionSequence",
      "<RelationshipCheckSequence",
    ]) {
      expect(content).toContain(tag);
    }
  });

  it("embeds capacity assumptions matching the estimates test", () => {
    expect(content).toContain("requestsPerSec: 200000");
    expect(content).toContain("checksPerRequest: 3");
    expect(content).toContain("decisionCpuMs: 0.5");
    expect(content).toContain("cacheHitRate: 0.9");
    expect(content).toContain("msPerCorePerSec: 1000");
  });

  it("includes at least four knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("includes at least ten FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(10);
  });
});
