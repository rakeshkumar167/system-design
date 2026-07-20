import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/tutorials/photo-sharing.mdx", "utf8");

const requiredIds = [
  "interview-framing",
  "requirements",
  "capacity-estimates",
  "entity-model",
  "api-design",
  "high-level-architecture",
  "detailed-flows",
  "upload-path",
  "image-pipeline",
  "serving-cdn",
  "feed-generation",
  "metadata-social",
  "storage-tiering",
  "scalability-evolution",
  "resiliency-failure-modes",
  "tradeoffs-alternatives",
  "interview-summary",
  "knowledge-checks-faq",
];

describe("Photo Sharing tutorial content", () => {
  it("contains all eighteen required section anchors", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the capacity model, architecture, and all four flow diagrams", () => {
    for (const tag of [
      "<PhotoSharingCapacity",
      "<PhotoSharingArchitecture",
      "<UploadPhotoSequence",
      "<ProcessImageSequence",
      "<ServeImageSequence",
      "<FeedLoadSequence",
    ]) {
      expect(content).toContain(tag);
    }
  });

  it("embeds capacity assumptions matching the estimates test", () => {
    expect(content).toContain("uploadsPerDay: 100000000");
    expect(content).toContain("derivativesPerPhoto: 5");
    expect(content).toContain("originalBytes: 4000000");
    expect(content).toContain("derivativeBytes: 400000");
    expect(content).toContain("viewsPerUpload: 100");
    expect(content).toContain("cdnHitRate: 0.98");
  });

  it("includes at least six knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("includes at least twelve FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(12);
  });
});
