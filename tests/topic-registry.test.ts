import { describe, it, expect } from "vitest";
import { getTopic, topicMetas } from "@/lib/topic-registry";
import { topicCategories } from "@/lib/topics";

describe("topic registry", () => {
  it("registers the authentication topic", () => {
    expect(Object.keys(topicMetas)).toContain("authentication");
  });
  it("describes authentication's eleven sections", () => {
    expect(getTopic("authentication")?.sections).toHaveLength(11);
  });
  it("gives every section a unique id and a valid depth", () => {
    const sections = getTopic("authentication")!.sections;
    const ids = sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of sections) {
      expect(["fundamentals", "interview-ready", "advanced"]).toContain(s.depth);
    }
  });
  it("points every registered topic at a real category", () => {
    const slugs = new Set(topicCategories.map((c) => c.slug));
    for (const meta of Object.values(topicMetas)) {
      expect(slugs.has(meta.categorySlug)).toBe(true);
    }
  });
  it("returns undefined for an unregistered topic", () => {
    expect(getTopic("rate-limiting")).toBeUndefined();
  });
  it("registers the TLS topic", () => {
    expect(Object.keys(topicMetas)).toContain("tls-https-certificates");
  });
  it("describes the TLS topic's ten sections", () => {
    expect(getTopic("tls-https-certificates")?.sections).toHaveLength(10);
  });
  it("gives every TLS section a unique id and a valid depth", () => {
    const sections = getTopic("tls-https-certificates")!.sections;
    const ids = sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of sections) {
      expect(["fundamentals", "interview-ready", "advanced"]).toContain(s.depth);
    }
  });
  it("registers the Authorization topic", () => {
    expect(Object.keys(topicMetas)).toContain("authorization");
  });
  it("describes the Authorization topic's ten sections", () => {
    expect(getTopic("authorization")?.sections).toHaveLength(10);
  });
  it("gives every Authorization section a unique id and a valid depth", () => {
    const sections = getTopic("authorization")!.sections;
    const ids = sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of sections) {
      expect(["fundamentals", "interview-ready", "advanced"]).toContain(s.depth);
    }
  });
  it("registers the Password Hashing topic", () => {
    expect(Object.keys(topicMetas)).toContain("password-hashing");
  });
  it("describes the Password Hashing topic's ten sections", () => {
    expect(getTopic("password-hashing")?.sections).toHaveLength(10);
  });
  it("gives every Password Hashing section a unique id and a valid depth", () => {
    const sections = getTopic("password-hashing")!.sections;
    const ids = sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of sections) {
      expect(["fundamentals", "interview-ready", "advanced"]).toContain(s.depth);
    }
  });
  it("registers the Encryption & Key Management topic", () => {
    expect(Object.keys(topicMetas)).toContain("encryption-key-management");
  });
  it("describes the Encryption topic's ten sections", () => {
    expect(getTopic("encryption-key-management")?.sections).toHaveLength(10);
  });
  it("gives every Encryption section a unique id and a valid depth", () => {
    const sections = getTopic("encryption-key-management")!.sections;
    const ids = sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of sections) {
      expect(["fundamentals", "interview-ready", "advanced"]).toContain(s.depth);
    }
  });
  it("registers the OWASP Top 10 topic", () => {
    expect(Object.keys(topicMetas)).toContain("owasp-top-10");
  });
  it("describes the OWASP topic's ten sections", () => {
    expect(getTopic("owasp-top-10")?.sections).toHaveLength(10);
  });
  it("gives every OWASP section a unique id and a valid depth", () => {
    const sections = getTopic("owasp-top-10")!.sections;
    const ids = sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of sections) {
      expect(["fundamentals", "interview-ready", "advanced"]).toContain(s.depth);
    }
  });
  it("registers the API Security topic", () => {
    expect(Object.keys(topicMetas)).toContain("api-security");
  });
  it("describes the API Security topic's ten sections", () => {
    expect(getTopic("api-security")?.sections).toHaveLength(10);
  });
  it("gives every API Security section a unique id and a valid depth", () => {
    const sections = getTopic("api-security")!.sections;
    const ids = sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of sections) {
      expect(["fundamentals", "interview-ready", "advanced"]).toContain(s.depth);
    }
  });
  it("registers the Session Management topic", () => {
    expect(Object.keys(topicMetas)).toContain("session-management");
  });
  it("describes the Session Management topic's ten sections", () => {
    expect(getTopic("session-management")?.sections).toHaveLength(10);
  });
  it("gives every Session Management section a unique id and a valid depth", () => {
    const sections = getTopic("session-management")!.sections;
    const ids = sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of sections) {
      expect(["fundamentals", "interview-ready", "advanced"]).toContain(s.depth);
    }
  });
  it("registers the Secure SDLC topic", () => {
    expect(Object.keys(topicMetas)).toContain("secure-sdlc");
  });
  it("describes the Secure SDLC topic's ten sections", () => {
    expect(getTopic("secure-sdlc")?.sections).toHaveLength(10);
  });
  it("gives every Secure SDLC section a unique id and a valid depth", () => {
    const sections = getTopic("secure-sdlc")!.sections;
    const ids = sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of sections) {
      expect(["fundamentals", "interview-ready", "advanced"]).toContain(s.depth);
    }
  });
});
