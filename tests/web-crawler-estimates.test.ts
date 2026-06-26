import { describe, it, expect } from "vitest";
import { calculateWebCrawlerCapacity } from "@/lib/web-crawler-estimates";

describe("calculateWebCrawlerCapacity", () => {
  const result = calculateWebCrawlerCapacity({
    pagesToCrawl: 30_000_000_000,
    crawlDays: 30,
    avgPageSizeKb: 100,
    pagesPerSecPerCrawler: 100,
    bytesPerUrlExact: 50,
    bloomBitsPerUrl: 10,
  });

  it("derives the sustained crawl rate in pages per second", () => {
    expect(result.avgCrawlRatePps).toBeCloseTo(11574.07, 1);
  });
  it("derives the fetcher fleet size", () => {
    expect(result.crawlersNeeded).toBe(116);
  });
  it("derives the sustained download bandwidth in Gbps", () => {
    expect(result.bandwidthGbps).toBeCloseTo(9.26, 2);
  });
  it("derives the exact seen-set size in TB", () => {
    expect(result.exactSeenSetTb).toBe(1.5);
  });
  it("derives the bloom-filter seen-set size in GB", () => {
    expect(result.bloomFilterGb).toBe(37.5);
  });
  it("derives total content storage in PB", () => {
    expect(result.contentStoragePb).toBe(3);
  });
});
