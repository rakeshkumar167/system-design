import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/topics/authentication.mdx", "utf8");

const requiredIds = [
  "overview",
  "credentials-passwords",
  "sessions-vs-tokens",
  "capacity-estimates",
  "jwt-internals",
  "oauth2-delegated",
  "oidc",
  "mfa",
  "token-lifecycle",
  "pitfalls-best-practices",
  "knowledge-checks-faq",
];

describe("Authentication topic content", () => {
  it("contains every required section anchor", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the capacity model and both flow diagrams", () => {
    for (const tag of [
      "<AuthenticationCapacity",
      "<OAuthAuthCodeSequence",
      "<SessionVsTokenSequence",
    ]) {
      expect(content).toContain(tag);
    }
  });

  it("includes at least four knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("includes at least ten FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(10);
  });
});
