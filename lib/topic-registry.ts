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
  "tls-https-certificates": {
    slug: "tls-https-certificates",
    categorySlug: "security",
    title: "TLS/HTTPS and Certificates",
    description:
      "How a connection becomes private, tamper-proof, and authenticated — the symmetric/asymmetric crypto split, the TLS handshake, certificates and the PKI chain of trust, certificate lifecycle, and TLS termination.",
    readingMinutes: 20,
    concepts: ["TLS handshake", "Certificates & PKI", "Forward secrecy", "TLS termination"],
    sections: [
      { id: "overview", label: "What TLS & HTTPS Are", depth: "fundamentals" },
      { id: "symmetric-asymmetric", label: "Symmetric vs Asymmetric Crypto", depth: "fundamentals" },
      { id: "tls-handshake", label: "The TLS Handshake", depth: "interview-ready" },
      { id: "capacity-estimates", label: "Capacity: The Cost of TLS", depth: "interview-ready" },
      { id: "certificates-pki", label: "Certificates & the Chain of Trust", depth: "interview-ready" },
      { id: "certificate-lifecycle", label: "Issuance, Expiry & Revocation", depth: "advanced" },
      { id: "https-in-practice", label: "HTTPS in Practice", depth: "interview-ready" },
      { id: "tls-termination", label: "TLS Termination & mTLS", depth: "advanced" },
      { id: "pitfalls-best-practices", label: "Pitfalls & Best Practices", depth: "interview-ready" },
      { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
    ],
  },
  authorization: {
    slug: "authorization",
    categorySlug: "security",
    title: "Authorization",
    description:
      "How a system decides what an authenticated principal may do — the access-control models (ACL, RBAC, ABAC, ReBAC), the policy architecture that separates deciding from enforcing, the cost of permission checks at scale, Google Zanzibar-style relationship checks, and enforcing in depth without object-level holes.",
    readingMinutes: 22,
    concepts: ["RBAC", "ABAC", "ReBAC", "Policy engines", "Least privilege"],
    sections: [
      { id: "overview", label: "What Authorization Is", depth: "fundamentals" },
      { id: "access-control-models", label: "Access-Control Models", depth: "fundamentals" },
      { id: "rbac", label: "Role-Based Access Control (RBAC)", depth: "interview-ready" },
      { id: "abac", label: "Attribute-Based Access Control (ABAC)", depth: "interview-ready" },
      { id: "policy-architecture", label: "Policy Architecture: PEP, PDP & Engines", depth: "interview-ready" },
      { id: "capacity-estimates", label: "Capacity: The Cost of Permission Checks", depth: "interview-ready" },
      { id: "relationship-based", label: "ReBAC & Google Zanzibar", depth: "advanced" },
      { id: "enforcement-in-practice", label: "Enforcement in Practice", depth: "interview-ready" },
      { id: "pitfalls-best-practices", label: "Pitfalls & Best Practices", depth: "interview-ready" },
      { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
    ],
  },
  "password-hashing": {
    slug: "password-hashing",
    categorySlug: "security",
    title: "Password Hashing",
    description:
      "How a system stores credentials so a database breach yields no usable passwords — why passwords are hashed and never encrypted, salting against rainbow tables, deliberately slow adaptive hashing and the work factor, the memory-hard algorithms (Argon2, scrypt, bcrypt, PBKDF2), the cost of hashing at scale, peppering, and constant-time verification.",
    readingMinutes: 22,
    concepts: ["Salting", "Work factor", "Argon2/bcrypt", "Memory-hardness", "Peppering"],
    sections: [
      { id: "overview", label: "What Password Hashing Is", depth: "fundamentals" },
      { id: "hashing-vs-encryption", label: "Hashing vs Encryption", depth: "fundamentals" },
      { id: "salting", label: "Salting & Rainbow Tables", depth: "interview-ready" },
      { id: "slow-hashing", label: "Slow Hashing & the Work Factor", depth: "interview-ready" },
      { id: "algorithms", label: "The Algorithms: Argon2, scrypt, bcrypt, PBKDF2", depth: "interview-ready" },
      { id: "capacity-estimates", label: "Capacity: The Cost of Hashing", depth: "interview-ready" },
      { id: "peppering-storage", label: "Peppering & Credential Storage", depth: "advanced" },
      { id: "verification-in-practice", label: "Verification in Practice", depth: "interview-ready" },
      { id: "pitfalls-best-practices", label: "Pitfalls & Best Practices", depth: "interview-ready" },
      { id: "knowledge-checks-faq", label: "Knowledge Checks & FAQ", depth: "fundamentals" },
    ],
  },
};

export function getTopic(slug: string): TopicMeta | undefined {
  return topicMetas[slug];
}
