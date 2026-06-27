import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/topics/tls-https-certificates.mdx", "utf8");

const requiredIds = [
  "overview",
  "symmetric-asymmetric",
  "tls-handshake",
  "capacity-estimates",
  "certificates-pki",
  "certificate-lifecycle",
  "https-in-practice",
  "tls-termination",
  "pitfalls-best-practices",
  "knowledge-checks-faq",
];

describe("TLS topic content", () => {
  it("contains every required section anchor", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the capacity model and both flow diagrams", () => {
    for (const tag of ["<TlsCapacity", "<TlsHandshakeSequence", "<CertValidationSequence"]) {
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
