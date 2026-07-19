import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/topics/password-hashing.mdx", "utf8");

const requiredIds = [
  "overview",
  "hashing-vs-encryption",
  "salting",
  "slow-hashing",
  "algorithms",
  "capacity-estimates",
  "peppering-storage",
  "verification-in-practice",
  "pitfalls-best-practices",
  "knowledge-checks-faq",
];

describe("Password Hashing topic content", () => {
  it("contains every required section anchor", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the capacity model and both flow diagrams", () => {
    for (const tag of [
      "<PasswordHashingCapacity",
      "<PasswordRegistrationSequence",
      "<PasswordVerificationSequence",
    ]) {
      expect(content).toContain(tag);
    }
  });

  it("embeds capacity assumptions matching the estimates test", () => {
    expect(content).toContain("loginsPerSec: 5000");
    expect(content).toContain("hashCostMs: 250");
    expect(content).toContain("hashMemoryMiB: 64");
    expect(content).toContain("msPerCorePerSec: 1000");
    expect(content).toContain("attackerFastHashesPerSec: 10000000000");
    expect(content).toContain("attackerSlowHashesPerSec: 2000");
  });

  it("includes at least four knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("includes at least ten FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(10);
  });
});
