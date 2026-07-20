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
  rider:    { x: 24,  y: 88,  w: 150, h: 56 },
  api:      { x: 220, y: 88,  w: 150, h: 56 },
  matcher:  { x: 430, y: 88,  w: 150, h: 56 },
  tripsvc:  { x: 640, y: 88,  w: 150, h: 56 },
  driver:   { x: 24,  y: 300, w: 150, h: 56 },
  locsvc:   { x: 220, y: 300, w: 150, h: 56 },
  geoindex: { x: 430, y: 300, w: 150, h: 60 },
} satisfies Record<string, NodeGeom>;

export function RideHailingArchitecture() {
  return (
    <DiagramFrame
      title="Ride-hailing architecture: rider, API, matching service, trip service, driver, location ingest, and in-memory geo index"
      viewBox="0 0 820 470"
      caption="Two data planes meet at the Geo Index. On the driver side, millions of drivers stream GPS pings every few seconds to the Location Ingest service, which updates each driver's current position in an in-memory geospatial index. On the rider side, a ride request goes to the Matching service, which queries the geo index for nearby available drivers, ranks them, and creates a trip in the Trip service — a state machine that then dispatches the offer and streams live location back to the rider. The system absorbs a huge location-update firehose into a live geo-index against which comparatively rare matching queries run."
    >
      <DiagramDefs />

      {/* Section labels */}
      <DiagramText x={24}  y={64}  bold size={11} muted>RIDER PATH</DiagramText>
      <DiagramText x={24}  y={278} bold size={11} muted>DRIVER PATH</DiagramText>
      <DiagramText x={430} y={278} bold size={11} muted>GEO INDEX</DiagramText>

      {/* Edges — drawn before nodes */}
      <Edge from={anchors.right(N.rider)} to={anchors.left(N.api)} variant="ingress" label="request ride" />
      <Edge from={anchors.right(N.api)} to={anchors.left(N.matcher)} variant="control" label="match request" />
      <Edge from={anchors.bottom(N.matcher)} to={anchors.top(N.geoindex)} variant="redirect" label="nearby available drivers" labelOffset={6} />
      <Edge from={anchors.right(N.matcher)} to={anchors.left(N.tripsvc)} variant="create" label="create trip" />
      <Edge from={anchors.right(N.driver)} to={anchors.left(N.locsvc)} variant="ingress" label="GPS ping / 4s" />
      <Edge from={anchors.right(N.locsvc)} to={anchors.left(N.geoindex)} variant="create" label="update position" />

      {/* Nodes */}
      <Node geom={N.rider}    kind="external" label="Rider"            sublabel="requests a ride" />
      <Node geom={N.api}      kind="service"  label="API"              sublabel="stateless" />
      <Node geom={N.matcher}  kind="service"  label="Matching Service" sublabel="query + rank" />
      <Node geom={N.tripsvc}  kind="service"  label="Trip Service"     sublabel="state machine" />
      <Node geom={N.driver}   kind="external" label="Driver"           sublabel="streams GPS" />
      <Node geom={N.locsvc}   kind="service"  label="Location Ingest"  sublabel="ping firehose" />
      <Node geom={N.geoindex} kind="store"    label="Geo Index"        sublabel="in-memory · latest-only" />

      <Legend
        x={24}
        y={430}
        items={[
          { variant: "ingress",  label: "Request / ping" },
          { variant: "control",  label: "Match" },
          { variant: "redirect", label: "Geo query" },
          { variant: "create",   label: "Create / update" },
        ]}
      />
    </DiagramFrame>
  );
}
