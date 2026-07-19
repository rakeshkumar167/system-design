import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/topics/secure-sdlc.mdx", "utf8");

const requiredIds = [
  "overview",
  "requirements-design",
  "secure-implementation",
  "security-testing",
  "supply-chain",
  "capacity-estimates",
  "deploy-runtime",
  "verification-response",
  "pitfalls-best-practices",
  "knowledge-checks-faq",
];

describe("Secure SDLC topic content", () => {
  it("contains every required section anchor", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the capacity model and both flow diagrams", () => {
    for (const tag of [
      "<SecureSdlcCapacity",
      "<SecureSdlcPipelineSequence",
      "<VulnerabilityResponseSequence",
    ]) {
      expect(content).toContain(tag);
    }
  });

  it("embeds capacity assumptions matching the estimates test", () => {
    expect(content).toContain("vulnsPerRelease: 100");
    expect(content).toContain("costFixInDesign: 100");
    expect(content).toContain("prodCostMultiplier: 100");
    expect(content).toContain("shiftLeftCatchRate: 0.9");
  });

  it("includes at least four knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("includes at least ten FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(10);
  });
});
