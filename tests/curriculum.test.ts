import { describe, it, expect } from "vitest";
import { getProblem, problems } from "@/lib/curriculum";

describe("curriculum", () => {
  it("contains the approved 33 unique problems", () => {
    expect(problems).toHaveLength(33);
    expect(new Set(problems.map((p) => p.slug)).size).toBe(33);
  });

  it("exposes URL Shortener, Rate Limiter, Pastebin, Notification Service, Distributed Cache, API Gateway, Web Crawler, Search Autocomplete, News Feed, Chat System, Video Streaming, Ticket Booking, Payment System, Distributed Logging, Collaborative Doc Editor, Cloud Drive, Maps and Navigation, and Distributed Job Scheduler as available", () => {
    expect(
      problems.filter((p) => p.status === "available").map((p) => p.slug),
    ).toEqual(["url-shortener", "rate-limiter", "pastebin", "notification-service", "distributed-cache", "api-gateway", "web-crawler", "search-autocomplete", "news-feed", "chat-system", "video-streaming", "object-storage", "photo-sharing", "ride-hailing", "ticket-booking", "payment-system", "metrics-monitoring", "distributed-logging", "collaborative-doc-editor", "cloud-drive", "maps-navigation", "distributed-job-scheduler", "leaderboard"]);
    expect(getProblem("rate-limiter")?.title).toBe("Rate Limiter");
    expect(getProblem("pastebin")?.title).toBe("Pastebin");
    expect(getProblem("notification-service")?.title).toBe("Notification Service");
    expect(getProblem("distributed-cache")?.title).toBe("Distributed Cache");
    expect(getProblem("api-gateway")?.title).toBe("API Gateway");
    expect(getProblem("chat-system")?.title).toBe("Chat System");
    expect(getProblem("web-crawler")?.title).toBe("Web Crawler");
    expect(getProblem("search-autocomplete")?.title).toBe("Search Autocomplete");
    expect(getProblem("news-feed")?.title).toBe("News Feed");
    expect(getProblem("video-streaming")?.title).toBe("Video Streaming Platform");
    expect(getProblem("ticket-booking")?.title).toBe("Ticket Booking System");
    expect(getProblem("payment-system")?.title).toBe("Payment System");
    expect(getProblem("distributed-logging")?.title).toBe("Distributed Logging Platform");
    expect(getProblem("collaborative-doc-editor")?.title).toBe("Collaborative Document Editor");
    expect(getProblem("cloud-drive")?.title).toBe("Cloud Drive");
    expect(getProblem("distributed-job-scheduler")?.title).toBe("Distributed Job Scheduler");
    expect(getProblem("maps-navigation")?.title).toBe("Maps and Navigation");
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
