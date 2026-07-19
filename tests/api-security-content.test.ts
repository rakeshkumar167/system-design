import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/topics/api-security.mdx", "utf8");

const requiredIds = [
  "overview",
  "authenticating-clients",
  "authorizing-requests",
  "data-exposure",
  "resource-consumption",
  "capacity-estimates",
  "api-gateway",
  "transport-misconfig",
  "pitfalls-best-practices",
  "knowledge-checks-faq",
];

describe("API Security topic content", () => {
  it("contains every required section anchor", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the capacity model and both flow diagrams", () => {
    for (const tag of [
      "<ApiSecurityCapacity",
      "<BolaAttackSequence",
      "<GatewayEnforcementSequence",
    ]) {
      expect(content).toContain(tag);
    }
  });

  it("embeds capacity assumptions matching the estimates test", () => {
    expect(content).toContain("requestsPerSec: 200000");
    expect(content).toContain("abusiveFraction: 0.5");
    expect(content).toContain("gatewayCheckCpuMs: 0.25");
    expect(content).toContain("backendCpuMs: 5");
    expect(content).toContain("msPerCorePerSec: 1000");
  });

  it("includes at least four knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("includes at least ten FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(10);
  });
});
