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
    expect(getTopic("password-hashing")).toBeUndefined();
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
});
