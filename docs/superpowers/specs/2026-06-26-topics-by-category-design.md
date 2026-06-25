# Topics by Category — Design

**Date:** 2026-06-26
**Status:** Approved

## Goal

Introduce a second, parallel taxonomy alongside the problem curriculum: **topics grouped
into categories**. Ship the first category — **Security** — with 12 placeholder topics.
Content is filled in incrementally; for now every topic is a non-clickable "coming soon"
card.

## Data model — `lib/topics.ts`

Types live in `lib/types.ts` next to the existing `Problem` types.

```ts
export interface Topic {
  slug: string;        // "authentication"
  title: string;       // "Authentication"
  blurb: string;       // "JWT, OAuth 2.0, OIDC" (may be "")
  status: "available" | "coming-soon";
}

export interface TopicCategory {
  slug: string;        // "security"
  title: string;       // "Security"
  summary: string;     // one-line category description
  topics: readonly Topic[];
}
```

`lib/topics.ts` exports `topicCategories: readonly TopicCategory[]` plus a
`getTopicCategory(slug)` helper, mirroring `lib/curriculum.ts`.

## Page — `app/topics/page.tsx`

- Header mirrors the curriculum page: "Topics" eyebrow, title, intro paragraph.
- One section per category (category title + summary), then a responsive grid of topic cards.

## Card — `components/topics/topic-card.tsx`

Styled like the existing `ProblemCard` coming-soon state: title, blurb as muted text, a
`Lock` "Coming soon" affordance. Rendered as a plain `div` (non-clickable) while
`status === "coming-soon"`. When a topic goes `available`, flip status and link to its
route.

## Navigation

Add a `Topics` link to `components/shell/site-header.tsx`, next to `Curriculum`.

## Security topics (seed, all `coming-soon`)

| title | blurb |
|---|---|
| Authentication | JWT, OAuth 2.0, OIDC |
| Authorization | RBAC, ABAC |
| TLS/HTTPS and certificates | |
| Password hashing | Argon2/bcrypt |
| Encryption and key management | |
| OWASP Top 10 | |
| API security | |
| Session management | |
| Rate limiting | |
| Secrets management | |
| Threat modeling | STRIDE |
| Secure SDLC | SAST, DAST, dependency scanning, penetration testing |

## Testing

Static placeholder data; a light registry sanity check (unique slugs) is optional. No
behavioral tests needed.

## Out of scope

Per-topic routes/pages, topic content, search/filter on the topics page, additional
categories beyond Security.
