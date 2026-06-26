const SECONDS_PER_DAY = 86_400;
const BYTES_PER_TB = 1_000_000_000_000;
const BYTES_PER_GB = 1_000_000_000;
const BITS_PER_BYTE = 8;
const BYTES_PER_KB = 1_000;

export interface WebCrawlerCapacityAssumptions {
  /** Total pages to crawl across the corpus. */
  pagesToCrawl: number;
  /** Days allotted to crawl the corpus once. */
  crawlDays: number;
  /** Average downloaded page size, in KB. */
  avgPageSizeKb: number;
  /** Pages per second one fetcher node can download. */
  pagesPerSecPerCrawler: number;
  /** Bytes to store one URL in an exact seen-set (string + metadata). */
  bytesPerUrlExact: number;
  /** Bloom-filter bits per URL (sets the false-positive rate). */
  bloomBitsPerUrl: number;
}

export interface WebCrawlerCapacityResults {
  avgCrawlRatePps: number;
  crawlersNeeded: number;
  bandwidthGbps: number;
  exactSeenSetTb: number;
  bloomFilterGb: number;
  contentStoragePb: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: fetching tens of billions of pages in a
 * month is an ordinary throughput problem (~11.6k pages/sec, ~9 Gbps, ~116 fetchers); the signature
 * difficulty is the seen-set — storing every crawled URL exactly is terabytes, but a bloom filter holds
 * the same set in ~40× less space at the cost of rare false positives, the only practical way to dedup
 * at scale; and the crawled corpus is multi-petabyte.
 */
export function calculateWebCrawlerCapacity(
  a: WebCrawlerCapacityAssumptions,
): WebCrawlerCapacityResults {
  const avgCrawlRatePps = a.pagesToCrawl / (a.crawlDays * SECONDS_PER_DAY);
  const crawlersNeeded = Math.ceil(avgCrawlRatePps / a.pagesPerSecPerCrawler);
  const bandwidthGbps =
    (avgCrawlRatePps * a.avgPageSizeKb * BYTES_PER_KB * BITS_PER_BYTE) / BYTES_PER_GB;
  const exactSeenSetTb = (a.pagesToCrawl * a.bytesPerUrlExact) / BYTES_PER_TB;
  const bloomFilterGb = (a.pagesToCrawl * a.bloomBitsPerUrl) / BITS_PER_BYTE / BYTES_PER_GB;
  const contentStoragePb =
    (a.pagesToCrawl * a.avgPageSizeKb * BYTES_PER_KB) / (BYTES_PER_TB * 1_000);

  return {
    avgCrawlRatePps,
    crawlersNeeded,
    bandwidthGbps,
    exactSeenSetTb,
    bloomFilterGb,
    contentStoragePb,
  };
}
