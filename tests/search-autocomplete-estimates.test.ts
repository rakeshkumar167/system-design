import { describe, it, expect } from "vitest";
import { calculateSearchAutocompleteCapacity } from "@/lib/search-autocomplete-estimates";

describe("calculateSearchAutocompleteCapacity", () => {
  const result = calculateSearchAutocompleteCapacity({
    dailySearches: 5_000_000_000,
    keystrokesPerSearch: 20,
    phrasesIndexed: 500_000_000,
    bytesPerPhrase: 40,
    perNodeQps: 10_000,
    logBytesPerEvent: 200,
  });

  it("derives the search QPS", () => {
    expect(result.searchQps).toBeCloseTo(57870.37, 1);
  });
  it("derives the read-amplified autocomplete QPS", () => {
    expect(result.autocompleteQps).toBeCloseTo(1157407.41, 1);
  });
  it("derives the serving fleet size", () => {
    expect(result.servingNodesNeeded).toBe(116);
  });
  it("derives the in-memory index size in GB", () => {
    expect(result.indexSizeGb).toBe(20);
  });
  it("derives the daily query-log volume in TB", () => {
    expect(result.dailyLogTb).toBe(1);
  });
});
