import { describe, it, expect } from "vitest";
import { getProblem, problems } from "@/lib/curriculum";

describe("curriculum", () => {
  it("contains the approved 33 unique problems", () => {
    expect(problems).toHaveLength(33);
    expect(new Set(problems.map((p) => p.slug)).size).toBe(33);
  });

  it("exposes URL Shortener, Rate Limiter, Pastebin, Notification Service, Distributed Cache, Video Streaming, Ticket Booking, Payment System, Collaborative Doc Editor, and Cloud Drive as available", () => {
    expect(
      problems.filter((p) => p.status === "available").map((p) => p.slug),
    ).toEqual(["url-shortener", "rate-limiter", "pastebin", "notification-service", "distributed-cache", "video-streaming", "ticket-booking", "payment-system", "collaborative-doc-editor", "cloud-drive"]);
    expect(getProblem("rate-limiter")?.title).toBe("Rate Limiter");
    expect(getProblem("pastebin")?.title).toBe("Pastebin");
    expect(getProblem("notification-service")?.title).toBe("Notification Service");
    expect(getProblem("distributed-cache")?.title).toBe("Distributed Cache");
    expect(getProblem("video-streaming")?.title).toBe("Video Streaming Platform");
    expect(getProblem("ticket-booking")?.title).toBe("Ticket Booking System");
    expect(getProblem("payment-system")?.title).toBe("Payment System");
    expect(getProblem("collaborative-doc-editor")?.title).toBe("Collaborative Document Editor");
    expect(getProblem("cloud-drive")?.title).toBe("Cloud Drive");
  });

  it("numbers problems sequentially from 1 to 33", () => {
    expect(problems.map((p) => p.sequence)).toEqual(
      Array.from({ length: 33 }, (_, i) => i + 1),
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
