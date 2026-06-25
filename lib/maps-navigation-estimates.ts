const SECONDS_PER_DAY = 86_400;
const BYTES_PER_GB = 1_000_000_000;

export interface MapsNavigationCapacityAssumptions {
  /** Graph nodes (road intersections). */
  nodes: number;
  /** Directed graph edges (road segments). */
  edges: number;
  /** Bytes to store one directed edge (endpoints + weight + adjacency). */
  bytesPerEdge: number;
  /** Route (navigation) requests per day. */
  routeRequestsPerDay: number;
  /** Map tiles fetched per route request (the map view around a route). */
  tilesPerRoute: number;
  /** Fraction of graph nodes a plain Dijkstra settles per query (~half). */
  dijkstraSettledFraction: number;
  /** Nodes a contraction-hierarchy query settles (a few hundred). */
  chNodesPerQuery: number;
}

export interface MapsNavigationCapacityResults {
  avgRouteQps: number;
  avgTileQps: number;
  graphSizeGb: number;
  dijkstraNodesPerQuery: number;
  naiveSettlesPerSecBillions: number;
  chSpeedup: number;
}

/**
 * Pure, deterministic capacity model. The lesson it teaches: route QPS is modest, but naive
 * per-query Dijkstra settles ~half a continental graph — ~hundreds of billions of node-settles
 * per second across the fleet, which is impossible — so a precomputed contraction hierarchy
 * collapses per-query work ~62,500×, turning routing into a millisecond in-memory lookup; the
 * routable graph fits in RAM (a few GB); and tiles dominate request volume (~50× routes) but are
 * static and CDN-cacheable.
 */
export function calculateMapsNavigationCapacity(
  a: MapsNavigationCapacityAssumptions,
): MapsNavigationCapacityResults {
  const avgRouteQps = a.routeRequestsPerDay / SECONDS_PER_DAY;
  const avgTileQps = avgRouteQps * a.tilesPerRoute;
  const graphSizeGb = (a.edges * a.bytesPerEdge) / BYTES_PER_GB;
  const dijkstraNodesPerQuery = a.nodes * a.dijkstraSettledFraction;
  const naiveSettlesPerSecBillions =
    (avgRouteQps * dijkstraNodesPerQuery) / 1_000_000_000;
  const chSpeedup = dijkstraNodesPerQuery / a.chNodesPerQuery;

  return {
    avgRouteQps,
    avgTileQps,
    graphSizeGb,
    dijkstraNodesPerQuery,
    naiveSettlesPerSecBillions,
    chSpeedup,
  };
}
