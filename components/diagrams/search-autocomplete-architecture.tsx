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
  client:       { x: 24,  y: 150, w: 150, h: 56 },
  autocomplete: { x: 220, y: 150, w: 150, h: 56 },
  cache:        { x: 430, y: 84,  w: 150, h: 60 },
  trieIndex:    { x: 430, y: 210, w: 150, h: 60 },
  queryLog:     { x: 220, y: 340, w: 150, h: 56 },
  aggregator:   { x: 430, y: 340, w: 150, h: 56 },
  builder:      { x: 640, y: 340, w: 150, h: 56 },
  trending:     { x: 640, y: 210, w: 150, h: 56 },
} satisfies Record<string, NodeGeom>;

export function SearchAutocompleteArchitecture() {
  return (
    <DiagramFrame
      title="Search Autocomplete architecture: client, autocomplete service, suggestion cache, trie index, query log, aggregator, index builder, and trending layer"
      viewBox="0 0 980 520"
      caption="The read path: every keystroke sends a prefix to the Autocomplete Service, which checks a Suggestion Cache for hot prefixes (cache hit returns immediately) and falls back to walking the Trie Index to the prefix node, where the precomputed top-k ranked completions are stored — O(prefix length), never a subtree scan. The service also logs each query event asynchronously to the Query Log. A batch Aggregator consumes these events, counts phrase frequencies, and the Index Builder constructs a new trie with top-k at every node and publishes an immutable index version. A real-time Trending layer detects velocity spikes and injects trending phrases into the served top-k between full rebuilds."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={24}  y={46} bold size={11} muted>READ PATH</DiagramText>
      <DiagramText x={220} y={46} bold size={11} muted>SERVING TIER</DiagramText>
      <DiagramText x={220} y={320} bold size={11} muted>BUILD PIPELINE</DiagramText>

      {/* Edges — drawn before nodes */}

      {/* Client → Autocomplete Service (prefix keystroke) */}
      <Edge
        from={anchors.right(N.client)}
        to={anchors.left(N.autocomplete)}
        variant="ingress"
        label="prefix keystroke"
      />

      {/* Autocomplete Service → Suggestion Cache (check cache) */}
      <Edge
        from={anchors.right(N.autocomplete)}
        to={anchors.left(N.cache)}
        variant="control"
        label="check cache"
        labelOffset={-10}
      />

      {/* Autocomplete Service → Trie Index (lookup top-k) */}
      <Edge
        from={anchors.right(N.autocomplete)}
        to={anchors.left(N.trieIndex)}
        variant="redirect"
        label="lookup top-k"
        labelOffset={10}
      />

      {/* Autocomplete Service → Query Log (log query event) */}
      <Edge
        from={anchors.bottom(N.autocomplete)}
        to={anchors.top(N.queryLog)}
        variant="async"
        label="log query event"
        labelOffset={6}
      />

      {/* Query Log → Aggregator (consume events) */}
      <Edge
        from={anchors.right(N.queryLog)}
        to={anchors.left(N.aggregator)}
        variant="async"
        label="consume events"
      />

      {/* Aggregator → Index Builder (frequency counts) */}
      <Edge
        from={anchors.right(N.aggregator)}
        to={anchors.left(N.builder)}
        variant="create"
        label="frequency counts"
      />

      {/* Index Builder → Trie Index (publish new index) */}
      <Edge
        from={anchors.top(N.builder)}
        to={anchors.right(N.trieIndex)}
        variant="create"
        label="publish new index"
        labelOffset={-10}
      />

      {/* Trending → Trie Index (inject trending phrase) */}
      <Edge
        from={anchors.left(N.trending)}
        to={anchors.right(N.trieIndex)}
        variant="async"
        label="inject trending phrase"
        labelOffset={-10}
      />

      {/* Nodes */}
      <Node geom={N.client}       kind="external" label="Client"               sublabel="types prefix" />
      <Node geom={N.autocomplete} kind="service"  label="Autocomplete Service" sublabel="prefix → top-k" />
      <Node geom={N.cache}        kind="cache"    label="Suggestion Cache"     sublabel="hot prefixes" />
      <Node geom={N.trieIndex}    kind="store"    label="Trie Index"           sublabel="in-memory" />
      <Node geom={N.queryLog}     kind="queue"    label="Query Log"            sublabel="search events" />
      <Node geom={N.aggregator}   kind="service"  label="Aggregator"           sublabel="batch counts" />
      <Node geom={N.builder}      kind="service"  label="Index Builder"        sublabel="build trie" />
      <Node geom={N.trending}     kind="service"  label="Trending"             sublabel="velocity spikes" />

      <Legend
        x={24}
        y={462}
        items={[
          { variant: "ingress",  label: "Prefix keystroke" },
          { variant: "control",  label: "Cache check" },
          { variant: "redirect", label: "Trie lookup" },
          { variant: "async",    label: "Async log / inject" },
          { variant: "create",   label: "Build / publish" },
        ]}
      />
    </DiagramFrame>
  );
}
