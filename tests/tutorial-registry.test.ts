import { describe, it, expect } from "vitest";
import { getTutorial, tutorials } from "@/lib/tutorial-registry";

describe("tutorial registry", () => {
  it("registers the URL Shortener, Rate Limiter, and Pastebin tutorials", () => {
    expect(Object.keys(tutorials).sort()).toEqual(["pastebin", "rate-limiter", "url-shortener"]);
  });

  it("describes the URL Shortener's eighteen sections, the Rate Limiter's fifteen, and the Pastebin's eighteen", () => {
    expect(getTutorial("url-shortener")?.sections).toHaveLength(18);
    expect(getTutorial("rate-limiter")?.sections).toHaveLength(15);
    expect(getTutorial("pastebin")?.sections).toHaveLength(18);
  });

  it("gives every section a unique id and a valid depth", () => {
    const sections = getTutorial("url-shortener")!.sections;
    const ids = sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of sections) {
      expect(["fundamentals", "interview-ready", "advanced"]).toContain(s.depth);
    }
  });

  it("returns undefined for unregistered tutorials", () => {
    expect(getTutorial("notification-service")).toBeUndefined();
  });
});
