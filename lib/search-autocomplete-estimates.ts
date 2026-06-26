const SECONDS_PER_DAY = 86_400;
const BYTES_PER_TB = 1_000_000_000_000;
const BYTES_PER_GB = 1_000_000_000;

export interface SearchAutocompleteCapacityAssumptions {
  /** Total searches submitted per day. */
  dailySearches: number;
  /** Autocomplete requests issued per search (≈ characters typed after debounce). */
  keystrokesPerSearch: number;
  /** Number of distinct phrases held in the ranked index. */
  phrasesIndexed: number;
  /** Bytes to store one phrase in the trie (string + top-k metadata, amortized). */
  bytesPerPhrase: number;
  /** Autocomplete requests one serving node can answer per second. */
  perNodeQps: number;
  /** Bytes logged per search event for the aggregation pipeline. */
  logBytesPerEvent: number;
}

export interface SearchAutocompleteCapacityResults {
  searchQps: number;
  autocompleteQps: number;
  servingNodesNeeded: number;
  indexSizeGb: number;
  dailyLogTb: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: every keystroke is a query, so
 * autocomplete is read-amplified to ~20× the search QPS (~1.16M QPS) — overwhelmingly read-dominated,
 * which forces precomputed top-k served from memory rather than per-query computation; the ranked
 * index is only ~20 GB, small enough to replicate into RAM on every serving node so reads scale by
 * adding identical replicas; and the query-log firehose feeding the ranking is ~1 TB/day.
 */
export function calculateSearchAutocompleteCapacity(
  a: SearchAutocompleteCapacityAssumptions,
): SearchAutocompleteCapacityResults {
  const searchQps = a.dailySearches / SECONDS_PER_DAY;
  const autocompleteQps = (a.dailySearches * a.keystrokesPerSearch) / SECONDS_PER_DAY;
  const servingNodesNeeded = Math.ceil(autocompleteQps / a.perNodeQps);
  const indexSizeGb = (a.phrasesIndexed * a.bytesPerPhrase) / BYTES_PER_GB;
  const dailyLogTb = (a.dailySearches * a.logBytesPerEvent) / BYTES_PER_TB;

  return {
    searchQps,
    autocompleteQps,
    servingNodesNeeded,
    indexSizeGb,
    dailyLogTb,
  };
}
