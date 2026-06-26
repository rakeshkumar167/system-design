import { describe, it, expect } from "vitest";
import { getTutorial, tutorials } from "@/lib/tutorial-registry";

describe("tutorial registry", () => {
  it("registers the URL Shortener, Rate Limiter, Pastebin, Notification Service, Distributed Cache, API Gateway, Ticket Booking, Video Streaming, Collaborative Doc Editor, Cloud Drive, Payment System, Distributed Logging, Distributed Job Scheduler, Maps and Navigation, and Web Crawler tutorials", () => {
    expect(Object.keys(tutorials).sort()).toEqual(["api-gateway", "cloud-drive", "collaborative-doc-editor", "distributed-cache", "distributed-job-scheduler", "distributed-logging", "maps-navigation", "notification-service", "pastebin", "payment-system", "rate-limiter", "ticket-booking", "url-shortener", "video-streaming", "web-crawler"]);
  });

  it("describes the URL Shortener's eighteen sections, the Rate Limiter's fifteen, the Pastebin's eighteen, the Notification Service's eighteen, the Distributed Cache's eighteen, the API Gateway's eighteen, the Ticket Booking's eighteen, the Video Streaming's eighteen, the Collaborative Doc Editor's eighteen, the Cloud Drive's eighteen, the Payment System's eighteen, the Distributed Logging's eighteen, the Distributed Job Scheduler's eighteen, the Maps and Navigation's eighteen, and the Web Crawler's eighteen", () => {
    expect(getTutorial("url-shortener")?.sections).toHaveLength(18);
    expect(getTutorial("rate-limiter")?.sections).toHaveLength(15);
    expect(getTutorial("pastebin")?.sections).toHaveLength(18);
    expect(getTutorial("notification-service")?.sections).toHaveLength(18);
    expect(getTutorial("distributed-cache")?.sections).toHaveLength(18);
    expect(getTutorial("api-gateway")?.sections).toHaveLength(18);
    expect(getTutorial("ticket-booking")?.sections).toHaveLength(18);
    expect(getTutorial("video-streaming")?.sections).toHaveLength(18);
    expect(getTutorial("collaborative-doc-editor")?.sections).toHaveLength(18);
    expect(getTutorial("cloud-drive")?.sections).toHaveLength(18);
    expect(getTutorial("payment-system")?.sections).toHaveLength(18);
    expect(getTutorial("distributed-logging")?.sections).toHaveLength(18);
    expect(getTutorial("distributed-job-scheduler")?.sections).toHaveLength(18);
    expect(getTutorial("maps-navigation")?.sections).toHaveLength(18);
    expect(getTutorial("web-crawler")?.sections).toHaveLength(18);
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
    expect(getTutorial("search-autocomplete")).toBeUndefined();
  });
});
