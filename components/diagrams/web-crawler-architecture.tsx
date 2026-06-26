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
  seeds:        { x: 24,  y: 232, w: 150, h: 56 },
  frontier:     { x: 200, y: 232, w: 150, h: 56 },
  fetcher:      { x: 400, y: 232, w: 150, h: 56 },
  parser:       { x: 620, y: 232, w: 150, h: 56 },
  seenSet:      { x: 800, y: 232, w: 150, h: 60 },
  dns:          { x: 400, y: 90,  w: 150, h: 56 },
  robotsCache:  { x: 620, y: 90,  w: 150, h: 60 },
  contentStore: { x: 800, y: 90,  w: 150, h: 60 },
  scheduler:    { x: 200, y: 392, w: 150, h: 56 },
} satisfies Record<string, NodeGeom>;

export function WebCrawlerArchitecture() {
  return (
    <DiagramFrame
      title="Web Crawler architecture: seeds, URL frontier, fetcher, DNS, robots cache, parser, seen-set, content store, and scheduler"
      viewBox="0 0 980 520"
      caption="The crawler runs a continuous loop: the URL frontier (organised as Mercator front/back queues for priority and per-host politeness) hands the fetcher a URL; the fetcher resolves DNS, checks cached robots.txt rules, downloads the page, and stores it in the content store; the parser extracts links; each discovered URL is checked against the bloom filter seen-set — already-seen URLs are dropped, new ones are added and re-enqueued; a separate scheduler re-enqueues known pages on a freshness cadence."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={24}  y={46} bold size={11} muted>SEEDS</DiagramText>
      <DiagramText x={200} y={46} bold size={11} muted>CRAWL LOOP</DiagramText>
      <DiagramText x={400} y={46} bold size={11} muted>SUPPORT SERVICES</DiagramText>
      <DiagramText x={200} y={370} bold size={11} muted>SCHEDULER</DiagramText>

      {/* Edges — drawn before nodes */}

      {/* Seeds → Frontier (seed input) */}
      <Edge
        from={anchors.right(N.seeds)}
        to={anchors.left(N.frontier)}
        variant="ingress"
        label="seed URLs"
      />

      {/* Frontier → Fetcher (dispatch next URL) */}
      <Edge
        from={anchors.right(N.frontier)}
        to={anchors.left(N.fetcher)}
        variant="redirect"
        label="next URL"
      />

      {/* Fetcher → DNS (host resolution) */}
      <Edge
        from={anchors.top(N.fetcher)}
        to={anchors.bottom(N.dns)}
        variant="muted"
        label="resolve host"
        labelOffset={-8}
      />

      {/* Fetcher → Robots Cache (politeness check) */}
      <Edge
        from={anchors.right(N.fetcher)}
        to={anchors.bottom(N.robotsCache)}
        variant="control"
        label="check rules"
        labelOffset={-10}
      />

      {/* Fetcher → Content Store (store downloaded page) */}
      <Edge
        from={anchors.right(N.fetcher)}
        to={anchors.left(N.contentStore)}
        variant="create"
        label="store page"
        labelOffset={8}
      />

      {/* Fetcher → Parser (send page for link extraction) */}
      <Edge
        from={anchors.right(N.fetcher)}
        to={anchors.left(N.parser)}
        variant="create"
        label="fetched page"
      />

      {/* Parser → Seen-Set (check URL dedup) */}
      <Edge
        from={anchors.right(N.parser)}
        to={anchors.left(N.seenSet)}
        variant="control"
        label="check seen"
        labelOffset={-14}
      />

      {/* Seen-Set → Frontier (enqueue new URLs — feedback loop) */}
      <Edge
        from={anchors.bottom(N.seenSet)}
        to={anchors.bottom(N.frontier)}
        variant="async"
        label="enqueue new URLs"
        labelOffset={18}
      />

      {/* Scheduler → Frontier (recrawl scheduling) */}
      <Edge
        from={anchors.top(N.scheduler)}
        to={anchors.bottom(N.frontier)}
        variant="async"
        label="schedule recrawl"
        labelOffset={6}
      />

      {/* Nodes */}
      <Node geom={N.seeds}        kind="infra"   label="Seeds"         sublabel="seed URLs" />
      <Node geom={N.frontier}     kind="queue"   label="URL Frontier"  sublabel="priority + politeness" />
      <Node geom={N.fetcher}      kind="service" label="Fetcher"       sublabel="download pages" />
      <Node geom={N.parser}       kind="service" label="Parser"        sublabel="extract links" />
      <Node geom={N.seenSet}      kind="store"   label="Seen-Set"      sublabel="URL dedup" />
      <Node geom={N.dns}          kind="cache"   label="DNS"           sublabel="cached" />
      <Node geom={N.robotsCache}  kind="store"   label="Robots Cache"  sublabel="robots.txt" />
      <Node geom={N.contentStore} kind="store"   label="Content Store" sublabel="crawled pages" />
      <Node geom={N.scheduler}    kind="service" label="Scheduler"     sublabel="re-crawl" />

      <Legend
        x={24}
        y={470}
        items={[
          { variant: "ingress",  label: "Seed input" },
          { variant: "redirect", label: "Frontier dispatch" },
          { variant: "create",   label: "Write / store" },
          { variant: "async",    label: "Async enqueue" },
          { variant: "control",  label: "Check / rule enforcement" },
          { variant: "muted",    label: "DNS resolve" },
        ]}
      />
    </DiagramFrame>
  );
}
