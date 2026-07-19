import {
  DiagramDefs,
  DiagramText,
  Edge,
  Legend,
  Node,
  anchors,
  type NodeGeom,
} from "./diagram-primitives";
import { DiagramFrame } from "./diagram-frame";

const N = {
  targets:     { x: 24,  y: 170, w: 150, h: 56 },
  ingest:      { x: 220, y: 170, w: 150, h: 56 },
  tsdb:        { x: 430, y: 168, w: 150, h: 60 },
  query:       { x: 640, y: 170, w: 150, h: 56 },
  dashboards:  { x: 640, y: 64,  w: 150, h: 56 },
  alerting:    { x: 640, y: 300, w: 150, h: 56 },
  downsampler: { x: 430, y: 300, w: 150, h: 56 },
} satisfies Record<string, NodeGeom>;

export function MetricsArchitecture() {
  return (
    <DiagramFrame
      title="Metrics and monitoring architecture: monitored targets, ingestion service, time-series database, downsampler, query engine, dashboards, and alerting engine"
      viewBox="0 0 820 470"
      caption="Monitored targets are scraped (or push their samples) to the Ingestion Service, which appends them to the Time-Series DB in a compressed, time-partitioned format. The Query Engine answers dashboard requests with range reads and aggregations, while the Alerting Engine continuously evaluates rules over recent windows and fires when they hold. A Downsampler compacts old raw blocks into lower-resolution rollups and expires them by retention policy, bounding long-term storage. The system is shaped by a relentless write firehose in and cheap, recent-range reads out — the opposite of a read-optimized store."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={24}  y={44} bold size={11} muted>COLLECTION</DiagramText>
      <DiagramText x={430} y={44} bold size={11} muted>STORAGE</DiagramText>
      <DiagramText x={640} y={44} bold size={11} muted>QUERY &amp; ALERTING</DiagramText>

      {/* Edges — drawn before nodes */}
      <Edge from={anchors.right(N.targets)} to={anchors.left(N.ingest)} variant="ingress" label="scrape / push" />
      <Edge from={anchors.right(N.ingest)} to={anchors.left(N.tsdb)} variant="create" label="append compressed" />
      <Edge from={anchors.right(N.tsdb)} to={anchors.left(N.query)} variant="redirect" label="range read" />
      <Edge from={anchors.top(N.query)} to={anchors.bottom(N.dashboards)} variant="redirect" label="series + aggregates" labelOffset={-10} />
      <Edge from={anchors.bottom(N.query)} to={anchors.top(N.alerting)} variant="control" label="evaluate rules" labelOffset={6} />
      <Edge from={anchors.bottom(N.tsdb)} to={anchors.top(N.downsampler)} variant="async" label="compact & roll up" labelOffset={6} />

      {/* Nodes */}
      <Node geom={N.targets}     kind="external" label="Monitored Targets" sublabel="exporters / agents" />
      <Node geom={N.ingest}      kind="service"  label="Ingestion Service" sublabel="scrape / receive" />
      <Node geom={N.tsdb}        kind="store"    label="Time-Series DB"    sublabel="compressed blocks" />
      <Node geom={N.query}       kind="service"  label="Query Engine"      sublabel="range + aggregate" />
      <Node geom={N.dashboards}  kind="external" label="Dashboards"        sublabel="PromQL queries" />
      <Node geom={N.alerting}    kind="service"  label="Alerting Engine"   sublabel="rules → paging" />
      <Node geom={N.downsampler} kind="service"  label="Downsampler"       sublabel="rollups + retention" />

      <Legend
        x={24}
        y={430}
        items={[
          { variant: "ingress",  label: "Scrape / push" },
          { variant: "create",   label: "Append" },
          { variant: "redirect", label: "Range read" },
          { variant: "control",  label: "Evaluate rules" },
          { variant: "async",    label: "Compact / downsample" },
        ]}
      />
    </DiagramFrame>
  );
}
