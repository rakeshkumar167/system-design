import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/topics/session-management.mdx", "utf8");

const requiredIds = [
  "overview",
  "session-ids-cookies",
  "server-vs-client-side",
  "lifecycle-timeouts",
  "session-attacks",
  "capacity-estimates",
  "distributed-sessions",
  "secure-sessions",
  "pitfalls-best-practices",
  "knowledge-checks-faq",
];

describe("Session Management topic content", () => {
  it("contains every required section anchor", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the capacity model and both flow diagrams", () => {
    for (const tag of [
      "<SessionCapacity",
      "<SessionFixationSequence",
      "<SecureLoginSessionSequence",
    ]) {
      expect(content).toContain(tag);
    }
  });

  it("embeds capacity assumptions matching the estimates test", () => {
    expect(content).toContain("requestsPerSec: 300000");
    expect(content).toContain("activeSessions: 50000000");
    expect(content).toContain("sessionBytes: 1000");
    expect(content).toContain("cacheHitRate: 0.95");
    expect(content).toContain("bytesPerGb: 1000000000");
  });

  it("includes at least four knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("includes at least ten FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(10);
  });
});
