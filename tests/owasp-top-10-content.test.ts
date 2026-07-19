import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/topics/owasp-top-10.mdx", "utf8");

const requiredIds = [
  "overview",
  "the-list",
  "broken-access-control",
  "cryptographic-failures",
  "injection",
  "capacity-estimates",
  "design-config-components",
  "remaining-risks",
  "pitfalls-best-practices",
  "knowledge-checks-faq",
];

describe("OWASP Top 10 topic content", () => {
  it("contains every required section anchor", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the capacity model and both attack diagrams", () => {
    for (const tag of [
      "<OwaspRiskCapacity",
      "<InjectionAttackSequence",
      "<SsrfAttackSequence",
    ]) {
      expect(content).toContain(tag);
    }
  });

  it("embeds capacity assumptions matching the estimates test", () => {
    expect(content).toContain("attackAttemptsPerDay: 1000000");
    expect(content).toContain("blockRatePerLayer: 0.9");
    expect(content).toContain("layers: 3");
  });

  it("includes at least four knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("includes at least ten FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(10);
  });
});
