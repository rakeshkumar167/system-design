import { describe, it, expect } from "vitest";
import { getProblem, problems } from "@/lib/curriculum";

describe("curriculum", () => {
  it("contains the approved 25 unique problems", () => {
    expect(problems).toHaveLength(25);
    expect(new Set(problems.map((p) => p.slug)).size).toBe(25);
  });

  it("exposes URL Shortener and Rate Limiter as available", () => {
    expect(
      problems.filter((p) => p.status === "available").map((p) => p.slug),
    ).toEqual(["url-shortener", "rate-limiter"]);
    expect(getProblem("rate-limiter")?.title).toBe("Rate Limiter");
  });

  it("numbers problems sequentially from 1 to 25", () => {
    expect(problems.map((p) => p.sequence)).toEqual(
      Array.from({ length: 25 }, (_, i) => i + 1),
    );
  });

  it("gives every problem a summary and at least three concepts", () => {
    for (const p of problems) {
      expect(p.summary.length).toBeGreaterThan(0);
      expect(p.concepts.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("returns undefined for an unknown slug", () => {
    expect(getProblem("does-not-exist")).toBeUndefined();
  });
});
