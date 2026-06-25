import {
  calculateMapsNavigationCapacity,
  type MapsNavigationCapacityAssumptions,
} from "@/lib/maps-navigation-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function MapsNavigationCapacity({
  assumptions,
}: {
  assumptions: MapsNavigationCapacityAssumptions;
}) {
  const r = calculateMapsNavigationCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Graph nodes", value: fmt(assumptions.nodes) },
    { label: "Graph edges", value: fmt(assumptions.edges) },
    { label: "Bytes / edge", value: `${fmt(assumptions.bytesPerEdge)} B` },
    { label: "Route requests / day", value: fmt(assumptions.routeRequestsPerDay) },
    { label: "Tiles / route", value: fmt(assumptions.tilesPerRoute) },
    { label: "Dijkstra settled fraction", value: `${fmt(assumptions.dijkstraSettledFraction * 100)}%` },
    { label: "CH nodes / query", value: fmt(assumptions.chNodesPerQuery) },
  ];

  const results: ResultRow[] = [
    { label: "Avg route QPS", value: fmt(r.avgRouteQps), consequence: "The steady-state navigation rate is modest — the difficulty is the per-query cost, not the request rate." },
    { label: "Avg tile QPS", value: fmt(r.avgTileQps), consequence: "Tiles outnumber routes ~50×, but they're static and CDN-cacheable — a delivery problem the edge absorbs, not a compute one." },
    { label: "Graph size (in RAM)", value: `${fmt(r.graphSizeGb, 2)} GB`, consequence: "The routable graph fits in memory, so route engines are stateless replicas serving from RAM — not a database queried per request." },
    { label: "Dijkstra nodes / query", value: fmt(r.dijkstraNodesPerQuery), consequence: "Plain Dijkstra settles ~half the continental graph for a single route — far too much work per query." },
    { label: "Naive settles / sec", value: `${fmt(r.naiveSettlesPerSecBillions, 2)} billion`, consequence: "Across the fleet that's hundreds of billions of node-settles per second — naive per-query routing is physically impossible." },
    { label: "Contraction-hierarchy speed-up", value: `${fmt(r.chSpeedup)}×`, consequence: "Precomputation cuts per-query work from 25M settles to a few hundred — routing becomes a millisecond in-memory lookup." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
