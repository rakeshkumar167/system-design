import type { TopicCategory } from "./types";

/**
 * Cross-cutting topics grouped into categories — a taxonomy parallel to the
 * problem curriculum in `curriculum.ts`. Topics start as `coming-soon`
 * placeholders and are filled in incrementally; flip a topic to `available`
 * (and add its route) once its content exists.
 */
export const topicCategories: readonly TopicCategory[] = [
  {
    slug: "security",
    title: "Security",
    summary:
      "The practices and primitives that keep a system and its users safe — from authentication and encryption to threat modeling and a secure delivery pipeline.",
    topics: [
      { slug: "authentication", title: "Authentication", blurb: "JWT, OAuth 2.0, OIDC", status: "available" },
      { slug: "authorization", title: "Authorization", blurb: "RBAC, ABAC", status: "available" },
      { slug: "tls-https-certificates", title: "TLS/HTTPS and certificates", blurb: "", status: "available" },
      { slug: "password-hashing", title: "Password hashing", blurb: "Argon2/bcrypt", status: "available" },
      { slug: "encryption-key-management", title: "Encryption and key management", blurb: "AES, KMS, envelope encryption", status: "available" },
      { slug: "owasp-top-10", title: "OWASP Top 10", blurb: "Injection, access control, SSRF", status: "available" },
      { slug: "api-security", title: "API security", blurb: "BOLA, tokens, gateways", status: "available" },
      { slug: "session-management", title: "Session management", blurb: "Cookies, fixation, CSRF", status: "available" },
      { slug: "rate-limiting", title: "Rate limiting", blurb: "", status: "coming-soon" },
      { slug: "secrets-management", title: "Secrets management", blurb: "", status: "coming-soon" },
      { slug: "threat-modeling", title: "Threat modeling", blurb: "STRIDE", status: "coming-soon" },
      {
        slug: "secure-sdlc",
        title: "Secure SDLC",
        blurb: "SAST, DAST, dependency scanning, penetration testing",
        status: "available",
      },
    ],
  },
];

export function getTopicCategory(slug: string): TopicCategory | undefined {
  return topicCategories.find((category) => category.slug === slug);
}
