import { describe, it, expect } from "vitest";
import { getTutorial, tutorials } from "@/lib/tutorial-registry";

describe("tutorial registry", () => {
  it("registers only the URL Shortener pilot", () => {
    expect(Object.keys(tutorials)).toEqual(["url-shortener"]);
  });

  it("describes all eighteen tutorial sections in order", () => {
    expect(getTutorial("url-shortener")?.sections).toHaveLength(18);
  });

  it("gives every section a unique id and a valid depth", () => {
    const sections = getTutorial("url-shortener")!.sections;
    const ids = sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of sections) {
      expect(["fundamentals", "interview-ready", "advanced"]).toContain(s.depth);
    }
  });

  it("returns undefined for unavailable tutorials", () => {
    expect(getTutorial("rate-limiter")).toBeUndefined();
  });
});
