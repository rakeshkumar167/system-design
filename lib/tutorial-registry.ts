import type { TutorialMeta } from "./types";

/**
 * Static registry of fully-authored tutorials, keyed by slug.
 *
 * Metadata only — no MDX component imports — so this module stays trivially
 * unit-testable. The route resolves slug → MDX content separately. Section
 * `id`s must match the heading ids inside the corresponding MDX file; they
 * drive the table of contents and in-page anchors.
 */
export const tutorials: Record<string, TutorialMeta> = {
  "url-shortener": {
    slug: "url-shortener",
    title: "Design a URL Shortener",
    description:
      "A complete, interview-grade walkthrough: requirements, capacity math, APIs, key generation, architecture, caching, consistency, scaling, resiliency, and security.",
    difficulty: "Foundational",
    readingMinutes: 35,
    concepts: ["Key generation", "Caching", "Read-heavy scaling", "Partitioning"],
    sections: [
      { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
      { id: "requirements", label: "Requirements", depth: "interview-ready" },
      { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
      { id: "entity-model", label: "Entity Model", depth: "interview-ready" },
      { id: "api-design", label: "API Design", depth: "interview-ready" },
      { id: "key-generation", label: "Key Generation", depth: "interview-ready" },
      { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
      { id: "detailed-flows", label: "Detailed Flows", depth: "interview-ready" },
      { id: "storage-partitioning", label: "Storage & Partitioning", depth: "advanced" },
      { id: "caching", label: "Caching", depth: "advanced" },
      { id: "consistency-concurrency", label: "Consistency & Concurrency", depth: "advanced" },
      { id: "scalability-evolution", label: "Scalability & Evolution", depth: "advanced" },
      { id: "resiliency-failure-modes", label: "Resiliency & Failure Modes", depth: "advanced" },
      { id: "security-abuse", label: "Security & Abuse", depth: "advanced" },
      { id: "observability", label: "Observability", depth: "advanced" },
      { id: "tradeoffs-alternatives", label: "Trade-offs & Alternatives", depth: "advanced" },
      { id: "interview-summary", label: "Interview Summary", depth: "interview-ready" },
      { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
    ],
  },
  "rate-limiter": {
    slug: "rate-limiter",
    title: "Design a Rate Limiter",
    description:
      "An algorithm-first, interview-grade walkthrough of a distributed rate limiter: the five classic algorithms, limit policies, the allow/throttle API, distributed counting, consistency, scaling, and failure modes.",
    difficulty: "Foundational",
    readingMinutes: 30,
    concepts: ["Token bucket", "Sliding window", "Distributed counters", "Fail-open"],
    sections: [
      { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
      { id: "requirements", label: "Requirements", depth: "interview-ready" },
      { id: "limit-policies", label: "Limit Policies & Keys", depth: "interview-ready" },
      { id: "algorithms", label: "Algorithms", depth: "interview-ready" },
      { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
      { id: "api-design", label: "API Design", depth: "interview-ready" },
      { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
      { id: "distributed-counting", label: "Distributed Counting", depth: "advanced" },
      { id: "consistency-races", label: "Consistency & Races", depth: "advanced" },
      { id: "scalability-evolution", label: "Scalability & Evolution", depth: "advanced" },
      { id: "resiliency-failure-modes", label: "Resiliency & Failure Modes", depth: "advanced" },
      { id: "observability", label: "Observability", depth: "advanced" },
      { id: "tradeoffs-alternatives", label: "Trade-offs & Alternatives", depth: "advanced" },
      { id: "interview-summary", label: "Interview Summary", depth: "interview-ready" },
      { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
    ],
  },
  "pastebin": {
    slug: "pastebin",
    title: "Design a Pastebin",
    description:
      "An interview-grade walkthrough of a Pastebin: storing large text blobs in object storage with metadata in a database, expiry and TTL, CDN delivery of immutable content, privacy and access control, scaling, and failure modes.",
    difficulty: "Foundational",
    readingMinutes: 32,
    concepts: ["Blob storage", "TTL & expiry", "CDN", "Access control"],
    sections: [
      { id: "interview-framing", label: "Interview Framing", depth: "fundamentals" },
      { id: "requirements", label: "Requirements", depth: "interview-ready" },
      { id: "capacity-estimates", label: "Capacity Estimates", depth: "interview-ready" },
      { id: "entity-model", label: "Entity Model", depth: "interview-ready" },
      { id: "api-design", label: "API Design", depth: "interview-ready" },
      { id: "high-level-architecture", label: "High-Level Architecture", depth: "interview-ready" },
      { id: "detailed-flows", label: "Detailed Flows", depth: "interview-ready" },
      { id: "blob-metadata-split", label: "Blob & Metadata Storage", depth: "advanced" },
      { id: "expiry-and-ttl", label: "Expiry & TTL", depth: "advanced" },
      { id: "caching-cdn", label: "Caching & CDN", depth: "advanced" },
      { id: "access-control", label: "Access Control & Privacy", depth: "advanced" },
      { id: "scalability-evolution", label: "Scalability & Evolution", depth: "advanced" },
      { id: "resiliency-failure-modes", label: "Resiliency & Failure Modes", depth: "advanced" },
      { id: "security-abuse", label: "Security & Abuse", depth: "advanced" },
      { id: "observability", label: "Observability", depth: "advanced" },
      { id: "tradeoffs-alternatives", label: "Trade-offs & Alternatives", depth: "advanced" },
      { id: "interview-summary", label: "Interview Summary", depth: "interview-ready" },
      { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
    ],
  },
};

export function getTutorial(slug: string): TutorialMeta | undefined {
  return tutorials[slug];
}
