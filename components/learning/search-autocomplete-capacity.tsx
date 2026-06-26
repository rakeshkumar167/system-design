import {
  calculateSearchAutocompleteCapacity,
  type SearchAutocompleteCapacityAssumptions,
} from "@/lib/search-autocomplete-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function SearchAutocompleteCapacity({
  assumptions,
}: {
  assumptions: SearchAutocompleteCapacityAssumptions;
}) {
  const r = calculateSearchAutocompleteCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Daily searches", value: fmt(assumptions.dailySearches) },
    { label: "Keystrokes / search", value: fmt(assumptions.keystrokesPerSearch) },
    { label: "Phrases indexed", value: fmt(assumptions.phrasesIndexed) },
    { label: "Bytes / phrase", value: `${fmt(assumptions.bytesPerPhrase)} B` },
    { label: "QPS / serving node", value: fmt(assumptions.perNodeQps) },
    { label: "Log bytes / event", value: `${fmt(assumptions.logBytesPerEvent)} B` },
  ];

  const results: ResultRow[] = [
    { label: "Search QPS", value: `${fmt(r.searchQps)} /s`, consequence: "The baseline rate of actual searches — modest next to the read load autocomplete generates." },
    { label: "Autocomplete QPS", value: `${fmt(r.autocompleteQps)} /s`, consequence: "Every keystroke is a request, so the read load is ~20× the search QPS — autocomplete is overwhelmingly read-dominated." },
    { label: "Serving fleet", value: fmt(r.servingNodesNeeded), consequence: "Sized by autocomplete QPS ÷ per-node throughput; stateless replicas that each hold a full copy of the index." },
    { label: "Index size (in RAM)", value: `${fmt(r.indexSizeGb)} GB`, consequence: "The ranked index is small enough to replicate into the RAM of every serving node — which is what makes sub-100 ms at over a million QPS achievable." },
    { label: "Query log / day", value: `${fmt(r.dailyLogTb)} TB`, consequence: "The firehose of search events the batch pipeline aggregates into popularity scores." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
