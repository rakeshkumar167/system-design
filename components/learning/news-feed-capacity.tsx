import {
  calculateNewsFeedCapacity,
  type NewsFeedCapacityAssumptions,
} from "@/lib/news-feed-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function NewsFeedCapacity({
  assumptions,
}: {
  assumptions: NewsFeedCapacityAssumptions;
}) {
  const r = calculateNewsFeedCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Daily active users", value: fmt(assumptions.dailyActiveUsers) },
    { label: "Daily posts", value: fmt(assumptions.dailyPosts) },
    { label: "Avg followers", value: fmt(assumptions.avgFollowers) },
    { label: "Feed reads / user / day", value: fmt(assumptions.feedReadsPerUserPerDay) },
    { label: "Feed length cached", value: fmt(assumptions.feedLengthCached) },
    { label: "Bytes / feed entry", value: `${fmt(assumptions.bytesPerFeedEntry)} B` },
  ];

  const results: ResultRow[] = [
    { label: "Posts / sec", value: `${fmt(r.postsPerSec)} /s`, consequence: "Posting itself is modest — the write load only explodes after fan-out." },
    { label: "Fan-out writes / sec", value: `${fmt(r.fanoutWritesPerSec)} /s`, consequence: "Each post is multiplied by its author's followers (~300×) — fan-out-on-write turns a read product into a write-heavy system." },
    { label: "Feed reads / sec", value: `${fmt(r.feedReadsPerSec)} /s`, consequence: "Reads are cheap — a single lookup of the precomputed feed — which is exactly what fan-out buys." },
    { label: "Fan-out workers", value: fmt(r.fanoutWorkersNeeded), consequence: "Sized by the fan-out write rate ÷ per-worker throughput; the async pipeline absorbs post spikes." },
    { label: "Feed storage", value: `${fmt(r.feedStorageTb, 1)} TB`, consequence: "Feeds store only post IDs (not content) in a distributed cache, hydrated from the post store at read time." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
