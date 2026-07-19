import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/topics/encryption-key-management.mdx", "utf8");

const requiredIds = [
  "overview",
  "symmetric-asymmetric",
  "data-states",
  "envelope-encryption",
  "kms-hsm",
  "capacity-estimates",
  "key-rotation-lifecycle",
  "key-management-in-practice",
  "pitfalls-best-practices",
  "knowledge-checks-faq",
];

describe("Encryption & Key Management topic content", () => {
  it("contains every required section anchor", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the capacity model and both flow diagrams", () => {
    for (const tag of [
      "<EncryptionCapacity",
      "<EnvelopeEncryptSequence",
      "<EnvelopeDecryptSequence",
    ]) {
      expect(content).toContain(tag);
    }
  });

  it("embeds capacity assumptions matching the estimates test", () => {
    expect(content).toContain("operationsPerSec: 500000");
    expect(content).toContain("kmsUnwrapMs: 20");
    expect(content).toContain("dekCacheHitRate: 0.999");
    expect(content).toContain("aesEncryptMs: 0.01");
    expect(content).toContain("msPerCorePerSec: 1000");
  });

  it("includes at least four knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("includes at least ten FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(10);
  });
});
