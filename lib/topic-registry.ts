import type { TopicMeta } from "./types";

/**
 * Static registry of fully-authored topics, keyed by slug. Metadata only (no MDX imports)
 * so it stays trivially unit-testable; the route resolves slug → MDX separately. Section
 * `id`s must match the heading ids in the corresponding MDX file.
 */
export const topicMetas: Record<string, TopicMeta> = {
  authentication: {
    slug: "authentication",
    categorySlug: "security",
    title: "Authentication",
    description:
      "How a system proves who a user is — from password login and the sessions-vs-tokens decision through JWTs, OAuth 2.0, OpenID Connect, MFA, and the token lifecycle.",
    readingMinutes: 22,
    concepts: ["Sessions vs tokens", "JWT", "OAuth 2.0", "OIDC", "MFA"],
    sections: [
      { id: "overview", label: "What Authentication Is", depth: "fundamentals" },
      { id: "credentials-passwords", label: "Credentials & Password Login", depth: "fundamentals" },
      { id: "sessions-vs-tokens", label: "Sessions vs Tokens", depth: "interview-ready" },
      { id: "capacity-estimates", label: "Capacity: The Cost of Verifying", depth: "interview-ready" },
      { id: "jwt-internals", label: "JWT Internals", depth: "interview-ready" },
      { id: "oauth2-delegated", label: "OAuth 2.0", depth: "advanced" },
      { id: "oidc", label: "OpenID Connect (OIDC)", depth: "advanced" },
      { id: "mfa", label: "Multi-Factor Authentication", depth: "interview-ready" },
      { id: "token-lifecycle", label: "Token Lifecycle: Refresh & Revocation", depth: "advanced" },
      { id: "pitfalls-best-practices", label: "Pitfalls & Best Practices", depth: "interview-ready" },
      { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
    ],
  },
};

export function getTopic(slug: string): TopicMeta | undefined {
  return topicMetas[slug];
}
