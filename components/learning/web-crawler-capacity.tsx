import {
  calculateWebCrawlerCapacity,
  type WebCrawlerCapacityAssumptions,
} from "@/lib/web-crawler-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function WebCrawlerCapacity({
  assumptions,
}: {
  assumptions: WebCrawlerCapacityAssumptions;
}) {
  const r = calculateWebCrawlerCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Pages to crawl", value: fmt(assumptions.pagesToCrawl) },
    { label: "Crawl window", value: `${fmt(assumptions.crawlDays)} d` },
    { label: "Avg page size", value: `${fmt(assumptions.avgPageSizeKb)} KB` },
    { label: "Pages/sec per fetcher", value: fmt(assumptions.pagesPerSecPerCrawler) },
    { label: "Bytes / URL (exact)", value: `${fmt(assumptions.bytesPerUrlExact)} B` },
    { label: "Bloom bits / URL", value: fmt(assumptions.bloomBitsPerUrl) },
  ];

  const results: ResultRow[] = [
    { label: "Crawl rate", value: `${fmt(r.avgCrawlRatePps)} pages/s`, consequence: "To cover the corpus in the window you sustain this rate — fetching is an ordinary throughput problem." },
    { label: "Fetcher fleet", value: fmt(r.crawlersNeeded), consequence: "Sized by crawl rate ÷ per-node throughput; fetching is massively parallel async I/O." },
    { label: "Bandwidth", value: `${fmt(r.bandwidthGbps, 2)} Gbps`, consequence: "Downloading at that rate needs steady multi-Gbps bandwidth — a real but manageable constraint." },
    { label: "Seen-set (exact)", value: `${fmt(r.exactSeenSetTb, 1)} TB`, consequence: "Storing every crawled URL exactly is terabytes — too big to keep in memory per node." },
    { label: "Seen-set (bloom filter)", value: `${fmt(r.bloomFilterGb, 1)} GB`, consequence: "A bloom filter holds the same URLs in ~40× less space (rare false positives = occasionally skipping a page) — the only way to dedup at this scale." },
    { label: "Content storage", value: `${fmt(r.contentStoragePb)} PB`, consequence: "The crawled corpus is multi-petabyte, kept in a distributed blob store." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
