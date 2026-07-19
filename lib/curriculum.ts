import type { Problem } from "./types";

/**
 * The 33-problem system design curriculum, in recommended reading order.
 * Authored tutorials are `available`; the rest are `coming-soon`.
 */
export const problems: readonly Problem[] = [
  {
    slug: "url-shortener",
    title: "URL Shortener",
    summary:
      "Map billions of long URLs to short, collision-free keys and serve redirects in under 50ms.",
    difficulty: "Foundational",
    concepts: ["Key generation", "Caching", "Read-heavy scaling", "Partitioning"],
    status: "available",
    sequence: 1,
  },
  {
    slug: "rate-limiter",
    title: "Rate Limiter",
    summary:
      "Throttle requests fairly across a distributed fleet without a single coordination bottleneck.",
    difficulty: "Foundational",
    concepts: ["Token bucket", "Sliding window", "Distributed counters"],
    status: "available",
    sequence: 2,
  },
  {
    slug: "pastebin",
    title: "Pastebin",
    summary:
      "Store and serve large text snippets with expiry, privacy controls, and CDN delivery.",
    difficulty: "Foundational",
    concepts: ["Blob storage", "TTL & expiry", "CDN", "Access control"],
    status: "available",
    sequence: 3,
  },
  {
    slug: "notification-service",
    title: "Notification Service",
    summary:
      "Fan out push, SMS, and email reliably with retries, deduplication, and user preferences.",
    difficulty: "Intermediate",
    concepts: ["Fan-out", "Message queues", "Idempotency", "Retries"],
    status: "available",
    sequence: 4,
  },
  {
    slug: "distributed-cache",
    title: "Distributed Cache",
    summary:
      "Build a sharded, replicated in-memory cache with eviction policies and tunable consistency.",
    difficulty: "Intermediate",
    concepts: ["Consistent hashing", "Eviction", "Replication", "Hot keys"],
    status: "available",
    sequence: 5,
  },
  {
    slug: "api-gateway",
    title: "API Gateway",
    summary:
      "Route, authenticate, rate-limit, and observe traffic to many backend services from one edge.",
    difficulty: "Intermediate",
    concepts: ["Routing", "AuthN/AuthZ", "Rate limiting", "Observability"],
    status: "available",
    sequence: 6,
  },
  {
    slug: "web-crawler",
    title: "Web Crawler",
    summary:
      "Crawl the web at scale with politeness, deduplication, and freshness-aware scheduling.",
    difficulty: "Advanced",
    concepts: ["Frontier queue", "Dedup & hashing", "Politeness", "Scheduling"],
    status: "available",
    sequence: 7,
  },
  {
    slug: "search-autocomplete",
    title: "Search Autocomplete",
    summary:
      "Serve top-k prefix suggestions in milliseconds from a trie and ranking pipeline.",
    difficulty: "Intermediate",
    concepts: ["Trie", "Top-k ranking", "Low latency", "Precomputation"],
    status: "available",
    sequence: 8,
  },
  {
    slug: "news-feed",
    title: "News Feed",
    summary:
      "Generate personalized feeds, balancing fan-out-on-write against read-time aggregation.",
    difficulty: "Advanced",
    concepts: ["Fan-out strategies", "Ranking", "Hot users", "Caching"],
    status: "available",
    sequence: 9,
  },
  {
    slug: "chat-system",
    title: "Chat System",
    summary:
      "Deliver real-time 1:1 and group messages with presence, ordering, and delivery guarantees.",
    difficulty: "Advanced",
    concepts: ["WebSockets", "Message ordering", "Presence", "Delivery semantics"],
    status: "available",
    sequence: 10,
  },
  {
    slug: "video-streaming",
    title: "Video Streaming Platform",
    summary:
      "Ingest, transcode, and stream adaptive-bitrate video to a global audience over a CDN.",
    difficulty: "Advanced",
    concepts: ["Transcoding", "Adaptive bitrate", "CDN", "Object storage"],
    status: "available",
    sequence: 11,
  },
  {
    slug: "object-storage",
    title: "Object Storage",
    summary:
      "Store and serve exabytes of immutable blobs durably with erasure coding and multipart uploads.",
    difficulty: "Advanced",
    concepts: ["Erasure coding", "Durability", "Multipart upload", "Metadata indexing"],
    status: "coming-soon",
    sequence: 12,
  },
  {
    slug: "photo-sharing",
    title: "Photo Sharing Platform",
    summary:
      "Upload, process, and serve images and feeds at social-network scale.",
    difficulty: "Advanced",
    concepts: ["Object storage", "Image pipeline", "Feed generation", "CDN"],
    status: "coming-soon",
    sequence: 13,
  },
  {
    slug: "ride-hailing",
    title: "Ride-Hailing Service",
    summary:
      "Match riders to nearby drivers in real time using geospatial indexing and dispatch.",
    difficulty: "Advanced",
    concepts: ["Geospatial indexing", "Matching", "Real-time updates", "State machines"],
    status: "coming-soon",
    sequence: 14,
  },
  {
    slug: "food-delivery",
    title: "Food Delivery Platform",
    summary:
      "Coordinate orders, restaurants, and couriers with live tracking and accurate ETAs.",
    difficulty: "Advanced",
    concepts: ["Order workflow", "Dispatch", "ETA estimation", "Geospatial"],
    status: "coming-soon",
    sequence: 15,
  },
  {
    slug: "ticket-booking",
    title: "Ticket Booking System",
    summary:
      "Sell limited inventory under heavy contention without overselling a single seat.",
    difficulty: "Advanced",
    concepts: ["Distributed locking", "Inventory", "Strong consistency", "Reservations"],
    status: "available",
    sequence: 16,
  },
  {
    slug: "ecommerce-platform",
    title: "E-commerce Platform",
    summary:
      "Run catalog, cart, checkout, and inventory across loosely coupled services.",
    difficulty: "Advanced",
    concepts: ["Catalog & search", "Cart", "Inventory", "Microservices"],
    status: "coming-soon",
    sequence: 17,
  },
  {
    slug: "payment-system",
    title: "Payment System",
    summary:
      "Process payments exactly once with ledgers, idempotency keys, and reconciliation.",
    difficulty: "Advanced",
    concepts: ["Double-entry ledger", "Idempotency", "Consistency", "Reconciliation"],
    status: "available",
    sequence: 18,
  },
  {
    slug: "metrics-monitoring",
    title: "Metrics and Monitoring System",
    summary:
      "Ingest, store, and query high-cardinality time-series data and drive alerting.",
    difficulty: "Advanced",
    concepts: ["Time-series storage", "Aggregation", "Downsampling", "Alerting"],
    status: "available",
    sequence: 19,
  },
  {
    slug: "distributed-logging",
    title: "Distributed Logging Platform",
    summary:
      "Collect, index, and search logs from thousands of services with retention tiers.",
    difficulty: "Advanced",
    concepts: ["Ingestion pipeline", "Indexing", "Search", "Retention"],
    status: "available",
    sequence: 20,
  },
  {
    slug: "message-queue",
    title: "Message Queue",
    summary:
      "Build a durable, ordered, at-least-once broker with consumer groups and replay.",
    difficulty: "Advanced",
    concepts: ["Durability", "Partitioning & ordering", "Delivery semantics", "Consumer groups"],
    status: "coming-soon",
    sequence: 21,
  },
  {
    slug: "collaborative-doc-editor",
    title: "Collaborative Document Editor",
    summary:
      "Enable real-time multi-user editing with conflict-free convergence via OT or CRDTs.",
    difficulty: "Advanced",
    concepts: ["CRDT / OT", "Real-time sync", "Conflict-free merge", "Presence"],
    status: "available",
    sequence: 22,
  },
  {
    slug: "cloud-drive",
    title: "Cloud Drive",
    summary:
      "Provide durable, shareable file storage with versioning, permissions, and previews.",
    difficulty: "Advanced",
    concepts: ["Object storage", "Versioning", "Sharing & ACLs", "Metadata"],
    status: "available",
    sequence: 23,
  },
  {
    slug: "maps-navigation",
    title: "Maps and Navigation",
    summary:
      "Compute shortest paths and live ETAs over a continental road graph with traffic.",
    difficulty: "Advanced",
    concepts: ["Graph routing", "Geospatial indexing", "Traffic modeling", "Precomputation"],
    status: "available",
    sequence: 24,
  },
  {
    slug: "ad-serving",
    title: "Ad Serving Platform",
    summary:
      "Select and serve targeted ads under tight latency budgets with pacing and auctions.",
    difficulty: "Advanced",
    concepts: ["Targeting", "Real-time bidding", "Budget pacing", "Low latency"],
    status: "coming-soon",
    sequence: 25,
  },
  {
    slug: "distributed-key-value-store",
    title: "Distributed Key-Value Store",
    summary:
      "Build a horizontally scalable, replicated key-value store with tunable consistency and quorums.",
    difficulty: "Advanced",
    concepts: ["Consistent hashing", "Quorum replication", "Vector clocks", "LSM storage"],
    status: "coming-soon",
    sequence: 26,
  },
  {
    slug: "unique-id-generator",
    title: "Unique ID Generator",
    summary:
      "Generate globally unique, roughly time-ordered IDs at massive scale without coordination.",
    difficulty: "Intermediate",
    concepts: ["Snowflake IDs", "Clock skew", "Monotonicity", "Partitioning"],
    status: "coming-soon",
    sequence: 27,
  },
  {
    slug: "proximity-service",
    title: "Proximity Service",
    summary:
      "Find nearby places or people fast with geospatial indexing over a constantly changing dataset.",
    difficulty: "Advanced",
    concepts: ["Geohashing", "Quadtree / S2", "Spatial indexing", "Read-heavy scaling"],
    status: "coming-soon",
    sequence: 28,
  },
  {
    slug: "digital-wallet",
    title: "Digital Wallet",
    summary:
      "Hold balances and move money between wallets exactly once with distributed transactions.",
    difficulty: "Advanced",
    concepts: ["Distributed transactions", "Idempotency", "Balance ledger", "Reservation"],
    status: "coming-soon",
    sequence: 29,
  },
  {
    slug: "distributed-job-scheduler",
    title: "Distributed Job Scheduler",
    summary:
      "Schedule and run millions of jobs reliably with at-least-once execution and leader leasing.",
    difficulty: "Advanced",
    concepts: ["At-least-once execution", "Leasing", "Time-based triggers", "Idempotency"],
    status: "available",
    sequence: 30,
  },
  {
    slug: "stock-exchange",
    title: "Stock Exchange",
    summary:
      "Match buy and sell orders fairly and deterministically under microsecond latency budgets.",
    difficulty: "Advanced",
    concepts: ["Matching engine", "Order book", "Deterministic sequencing", "Low latency"],
    status: "coming-soon",
    sequence: 31,
  },
  {
    slug: "leaderboard",
    title: "Leaderboard",
    summary:
      "Rank millions of players in real time with fast top-K queries and per-user rank lookups.",
    difficulty: "Intermediate",
    concepts: ["Sorted sets", "Ranking", "Sharding", "Real-time updates"],
    status: "available",
    sequence: 32,
  },
  {
    slug: "content-delivery-network",
    title: "Content Delivery Network",
    summary:
      "Serve static content from the edge with caching, invalidation, and origin offload at global scale.",
    difficulty: "Advanced",
    concepts: ["Edge caching", "Cache invalidation", "Origin shield", "Geo-routing"],
    status: "coming-soon",
    sequence: 33,
  },
];

export function getProblem(slug: string): Problem | undefined {
  return problems.find((problem) => problem.slug === slug);
}
