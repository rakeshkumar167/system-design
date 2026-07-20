import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/tutorials/object-storage.mdx", "utf8");

const requiredIds = [
  "interview-framing",
  "requirements",
  "capacity-estimates",
  "entity-model",
  "api-design",
  "high-level-architecture",
  "detailed-flows",
  "metadata-service",
  "durability-erasure-coding",
  "write-path-multipart",
  "read-path-reconstruction",
  "background-integrity",
  "consistency-versioning",
  "scalability-evolution",
  "resiliency-failure-modes",
  "tradeoffs-alternatives",
  "interview-summary",
  "knowledge-checks-faq",
];

describe("Object Storage tutorial content", () => {
  it("contains all eighteen required section anchors", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the capacity model, architecture, and all four flow diagrams", () => {
    for (const tag of [
      "<ObjectStorageCapacity",
      "<ObjectStorageArchitecture",
      "<PutObjectSequence",
      "<GetObjectSequence",
      "<MultipartUploadSequence",
      "<ScrubRepairSequence",
    ]) {
      expect(content).toContain(tag);
    }
  });

  it("embeds capacity assumptions matching the estimates test", () => {
    expect(content).toContain("objectsStored: 1000000000000");
    expect(content).toContain("avgObjectBytes: 1000000");
    expect(content).toContain("dataShards: 8");
    expect(content).toContain("parityShards: 4");
    expect(content).toContain("replicationFactor: 3");
  });

  it("includes at least six knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("includes at least twelve FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(12);
  });
});
