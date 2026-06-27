# TLS/HTTPS and Certificates Topic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the **TLS/HTTPS and Certificates** topic at `/topics/security/tls-https-certificates`, reusing the existing topic-content pipeline (registry, nested route, `TopicLayout`, available-card link) built with the Authentication topic.

**Architecture:** Add a registry entry + MDX content + one capacity model + two flow diagrams, and register them. The pipeline (route, layout, card) already exists — Task 3 *extends* it (new registry entry, new line in the route's `content` map, flip the card) rather than building it.

**Tech Stack:** Next.js App Router, MDX, TypeScript, Tailwind, Vitest + Testing Library, Playwright.

## Global Constraints

- Topic slug `tls-https-certificates`, category `security`, **10 sections**.
- Section `id`s must match across the MDX `<h2 id>`, the registry `sections`, and the content test `requiredIds`.
- New export names (`TlsCapacity`, `TlsHandshakeSequence`, `CertValidationSequence`) are currently unused — grep `mdx-components.tsx` before registering to confirm no clash.
- `getByText` duplicate-match gotcha: any phrase a diagram test asserts must appear in the **caption only**, never also as a node/step label.
- E2e uses **direct fragment navigation**, not TOC clicks.
- Adding a topic does **not** change the curriculum problem count — leave `tests/curriculum.test.ts` and the e2e "showing 1 of 33" assertion untouched.
- Capacity assumptions embedded in the MDX must **exactly** equal the estimates test's inputs.
- End every commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do not push or merge.

---

### Task 1: Capacity model — `TlsCapacity`

**Files:**
- Create: `lib/tls-estimates.ts`
- Create: `tests/tls-estimates.test.ts`
- Create: `components/learning/tls-capacity.tsx`
- Modify: `mdx-components.tsx` (import + register `TlsCapacity`)

**Interfaces:**
- Produces: `calculateTlsCapacity(a: TlsCapacityAssumptions): TlsCapacityResults`; React `TlsCapacity({ assumptions })`.
- Consumes: `CapacityTable`, `AssumptionRow`, `ResultRow` from `./capacity-table`.

- [ ] **Step 1: Write the failing estimates test** `tests/tls-estimates.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { calculateTlsCapacity } from "@/lib/tls-estimates";

describe("calculateTlsCapacity", () => {
  const result = calculateTlsCapacity({
    newConnectionsPerSec: 50_000,
    fullHandshakeCpuMs: 2,
    resumedHandshakeCpuMs: 0.1,
    resumptionRate: 0.8,
    msPerCorePerSec: 1_000,
  });

  it("derives full (unresumed) handshakes per second", () => {
    expect(result.fullHandshakesPerSec).toBe(10_000);
  });
  it("derives resumed handshakes per second", () => {
    expect(result.resumedHandshakesPerSec).toBe(40_000);
  });
  it("derives total handshake CPU milliseconds per second", () => {
    expect(result.handshakeCpuMsPerSec).toBeCloseTo(24_000, 5);
  });
  it("sizes the TLS CPU fleet with session resumption", () => {
    expect(result.coresWithResumption).toBe(24);
  });
  it("sizes the TLS CPU fleet without resumption", () => {
    expect(result.coresWithoutResumption).toBe(100);
  });
});
```

- [ ] **Step 2: Run it, expect failure** — `npm test -- tls-estimates` → FAIL (module not found).

- [ ] **Step 3: Implement `lib/tls-estimates.ts`**
```ts
export interface TlsCapacityAssumptions {
  /** New TLS connections established per second. */
  newConnectionsPerSec: number;
  /** CPU cost of a full (asymmetric) handshake, in milliseconds. */
  fullHandshakeCpuMs: number;
  /** CPU cost of a resumed handshake, in milliseconds. */
  resumedHandshakeCpuMs: number;
  /** Fraction of connections that resume a prior session (0–1). */
  resumptionRate: number;
  /** CPU milliseconds one core delivers per second (1000). */
  msPerCorePerSec: number;
}

export interface TlsCapacityResults {
  fullHandshakesPerSec: number;
  resumedHandshakesPerSec: number;
  handshakeCpuMsPerSec: number;
  coresWithResumption: number;
  coresWithoutResumption: number;
}

/**
 * Pure, deterministic capacity model. The lesson: the asymmetric TLS handshake is the expensive
 * part — bulk symmetric encryption of the actual bytes is cheap — so TLS termination is sized by
 * handshakes/sec, not throughput. Session resumption (a resumed handshake is ~20× cheaper here)
 * plus keep-alive amortize the cost: resuming 80% of connections cuts ~100 cores to ~24 (~4×),
 * which is why TLS is terminated at a shared, optimized edge.
 */
export function calculateTlsCapacity(a: TlsCapacityAssumptions): TlsCapacityResults {
  const fullHandshakesPerSec = a.newConnectionsPerSec * (1 - a.resumptionRate);
  const resumedHandshakesPerSec = a.newConnectionsPerSec * a.resumptionRate;
  const handshakeCpuMsPerSec =
    fullHandshakesPerSec * a.fullHandshakeCpuMs + resumedHandshakesPerSec * a.resumedHandshakeCpuMs;
  const coresWithResumption = Math.ceil(handshakeCpuMsPerSec / a.msPerCorePerSec);
  const coresWithoutResumption = Math.ceil(
    (a.newConnectionsPerSec * a.fullHandshakeCpuMs) / a.msPerCorePerSec,
  );

  return {
    fullHandshakesPerSec,
    resumedHandshakesPerSec,
    handshakeCpuMsPerSec,
    coresWithResumption,
    coresWithoutResumption,
  };
}
```

- [ ] **Step 4: Run it, expect pass** — `npm test -- tls-estimates` → PASS.

- [ ] **Step 5: Implement the wrapper `components/learning/tls-capacity.tsx`**
```tsx
import {
  calculateTlsCapacity,
  type TlsCapacityAssumptions,
} from "@/lib/tls-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function TlsCapacity({
  assumptions,
}: {
  assumptions: TlsCapacityAssumptions;
}) {
  const r = calculateTlsCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "New connections / sec", value: fmt(assumptions.newConnectionsPerSec) },
    { label: "Full handshake CPU", value: `${fmt(assumptions.fullHandshakeCpuMs, 1)} ms` },
    { label: "Resumed handshake CPU", value: `${fmt(assumptions.resumedHandshakeCpuMs, 1)} ms` },
    { label: "Resumption rate", value: `${fmt(assumptions.resumptionRate * 100)}%` },
    { label: "CPU ms / core / sec", value: fmt(assumptions.msPerCorePerSec) },
  ];

  const results: ResultRow[] = [
    { label: "Full handshakes / sec", value: `${fmt(r.fullHandshakesPerSec)} /s`, consequence: "The expensive asymmetric handshakes — new sessions with no prior state to resume." },
    { label: "Resumed handshakes / sec", value: `${fmt(r.resumedHandshakesPerSec)} /s`, consequence: "Cheap resumed sessions — roughly 20× less CPU than a full handshake." },
    { label: "Handshake CPU / sec", value: `${fmt(r.handshakeCpuMsPerSec)} ms/s`, consequence: "Total handshake CPU demand — dominated by the full handshakes, not the bytes transferred." },
    { label: "TLS cores (with resumption)", value: fmt(r.coresWithResumption), consequence: "Sized by handshakes/sec, not throughput. Resumption keeps the fleet small." },
    { label: "TLS cores (no resumption)", value: fmt(r.coresWithoutResumption), consequence: "Without resumption every connection pays the full handshake — ~4× the CPU. This is why resumption and edge termination matter." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
```

- [ ] **Step 6: Register in `mdx-components.tsx`** — add `import { TlsCapacity } from "@/components/learning/tls-capacity";` near the other capacity imports, and add `TlsCapacity,` to `teachingComponents`.

- [ ] **Step 7: Typecheck + lint + commit**
```bash
npm run typecheck && npm run lint
git add lib/tls-estimates.ts tests/tls-estimates.test.ts components/learning/tls-capacity.tsx mdx-components.tsx
git commit -m "feat: add TLS capacity model and wrapper"
```

---

### Task 2: Flow diagrams (run AFTER Task 1 — shares `mdx-components.tsx`)

**Files:**
- Create: `components/diagrams/tls-flows.tsx`
- Modify: `tests/diagrams.test.tsx` (append a describe block)
- Modify: `mdx-components.tsx` (import + register both sequences)

**Interfaces:**
- Produces: `TlsHandshakeSequence()`, `CertValidationSequence()`.
- Consumes: copy the file-local `Actor`/`Step` interfaces, constants, `actorColor`, `Sequence`, and `StepLabel` verbatim from `components/diagrams/chat-system-flows.tsx`.

- [ ] **Step 1: Create `components/diagrams/tls-flows.tsx`** — copy the header imports, `Actor`/`Step` interfaces, layout constants, `actorColor`, `Sequence`, and `StepLabel` from `chat-system-flows.tsx` exactly, then add:
```tsx
export function TlsHandshakeSequence() {
  return (
    <Sequence
      title="Sequence: the TLS handshake establishing an encrypted session"
      caption="Before any application data flows, the client and server negotiate a protocol version and cipher suite, the server presents its certificate to prove its identity, and both sides perform an ephemeral key exchange to independently derive the same shared session key — a value an eavesdropper watching every byte cannot reconstruct. Only then does encrypted HTTP traffic flow, protected by fast symmetric encryption. Because the key is ephemeral, stealing the server's private key later cannot decrypt these recorded sessions, which is forward secrecy."
      actors={[
        { id: "client", label: "Client",  kind: "external" },
        { id: "server", label: "Server",  kind: "service" },
      ]}
      steps={[
        { from: "client", to: "server", label: "ClientHello — versions, ciphers, key share", variant: "ingress" },
        { from: "server", to: "client", label: "ServerHello + certificate + key share",      variant: "redirect", reply: true },
        { from: "client", to: "client", label: "verify certificate, derive session key",      variant: "control" },
        { from: "client", to: "server", label: "Finished (verify), derive same key",          variant: "create" },
        { from: "client", to: "server", label: "encrypted application data (symmetric)",       variant: "redirect" },
      ]}
    />
  );
}

export function CertValidationSequence() {
  return (
    <Sequence
      title="Sequence: validating a certificate chain to a trusted root"
      caption="The server sends its leaf certificate together with any intermediate certificates. The client walks the chain, checking each certificate's signature against the next one up, until it reaches a root certificate that is pre-installed in its local trust store — the anchor it already trusts without being told to. It also confirms the certificate's domain matches the site and that nothing in the chain has expired. If the chain terminates at a trusted anchor and every check passes, the server's identity is accepted."
      actors={[
        { id: "client", label: "Client",      kind: "external" },
        { id: "server", label: "Server",      kind: "service" },
        { id: "store",  label: "Trust Store", kind: "cache" },
      ]}
      steps={[
        { from: "client", to: "server", label: "request connection",               variant: "ingress" },
        { from: "server", to: "client", label: "leaf + intermediate certificates",  variant: "redirect", reply: true },
        { from: "client", to: "client", label: "check signatures up the chain",     variant: "control" },
        { from: "client", to: "store",  label: "is the root a trusted anchor?",     variant: "control" },
        { from: "store",  to: "client", label: "yes — anchored, domain + dates ok",  variant: "redirect", reply: true },
      ]}
    />
  );
}
```

- [ ] **Step 2: Register in `mdx-components.tsx`** — add `import { TlsHandshakeSequence, CertValidationSequence } from "@/components/diagrams/tls-flows";` after the auth-flows import, and add both names to `teachingComponents`.

- [ ] **Step 3: Append render assertions to `tests/diagrams.test.tsx`**
```tsx
import {
  TlsHandshakeSequence,
  CertValidationSequence,
} from "@/components/diagrams/tls-flows";

describe("TLS flow diagrams", () => {
  it("exposes the TLS handshake to non-visual readers", () => {
    render(<TlsHandshakeSequence />);
    expect(
      screen.getByRole("img", { name: /tls handshake establishing an encrypted session/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/an eavesdropper watching every byte cannot reconstruct/i)).toBeInTheDocument();
  });

  it("exposes certificate-chain validation to non-visual readers", () => {
    render(<CertValidationSequence />);
    expect(
      screen.getByRole("img", { name: /validating a certificate chain to a trusted root/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/pre-installed in its local trust store/i)).toBeInTheDocument();
  });
});
```

(Both asserted phrases appear in captions only, never in a node or step label.)

- [ ] **Step 4: Run tests** — `npm test -- diagrams` → PASS.

- [ ] **Step 5: Typecheck + lint + commit**
```bash
npm run typecheck && npm run lint
git add components/diagrams/tls-flows.tsx tests/diagrams.test.tsx mdx-components.tsx
git commit -m "feat: add TLS handshake and certificate-chain diagrams"
```

---

### Task 3: Register route + skeleton (extend the existing pipeline)

**Files:**
- Modify: `lib/topic-registry.ts` (add the `tls-https-certificates` entry)
- Modify: `app/topics/[category]/[slug]/page.tsx` (import + add to `content` map)
- Modify: `lib/topics.ts` (flip `tls-https-certificates` → `available`)
- Create: `content/topics/tls-https-certificates.mdx` (10-heading skeleton)
- Modify: `tests/topic-registry.test.ts` (add assertions for the new topic)

**Interfaces:**
- Consumes: existing `topicMetas`, `getTopic`, `TopicLayout`, `getTopicCategory`.

- [ ] **Step 1: Add the registry entry to `lib/topic-registry.ts`** — insert this object into `topicMetas` after the `authentication` entry (before the closing `};`):
```ts
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
```

- [ ] **Step 2: Wire the route `app/topics/[category]/[slug]/page.tsx`** — add the import after the `AuthenticationContent` import:
```tsx
import TlsContent from "@/content/topics/tls-https-certificates.mdx";
```
and add the entry to the `content` map:
```tsx
const content: Record<string, ComponentType> = {
  authentication: AuthenticationContent,
  "tls-https-certificates": TlsContent,
};
```

- [ ] **Step 3: Flip the card in `lib/topics.ts`** — change the `tls-https-certificates` topic's `status: "coming-soon"` to `status: "available"` (leave its blurb `"TLS/HTTPS and certificates"` — wait, its current blurb is `""`; leave it as-is).

- [ ] **Step 4: Create the skeleton `content/topics/tls-https-certificates.mdx`** — 10 headings, one placeholder line each:
```mdx
<h2 id="overview">What TLS & HTTPS Are</h2>

Placeholder.

<h2 id="symmetric-asymmetric">Symmetric vs Asymmetric Crypto</h2>

Placeholder.

<h2 id="tls-handshake">The TLS Handshake</h2>

Placeholder.

<h2 id="capacity-estimates">Capacity: The Cost of TLS</h2>

Placeholder.

<h2 id="certificates-pki">Certificates & the Chain of Trust</h2>

Placeholder.

<h2 id="certificate-lifecycle">Issuance, Expiry & Revocation</h2>

Placeholder.

<h2 id="https-in-practice">HTTPS in Practice</h2>

Placeholder.

<h2 id="tls-termination">TLS Termination & mTLS</h2>

Placeholder.

<h2 id="pitfalls-best-practices">Pitfalls & Best Practices</h2>

Placeholder.

<h2 id="knowledge-checks-faq">Knowledge Checks & FAQ</h2>

Placeholder.
```

- [ ] **Step 5: Extend `tests/topic-registry.test.ts`** — add these `it` blocks inside the existing `describe("topic registry", ...)`:
```ts
  it("registers the TLS topic", () => {
    expect(Object.keys(topicMetas)).toContain("tls-https-certificates");
  });
  it("describes the TLS topic's ten sections", () => {
    expect(getTopic("tls-https-certificates")?.sections).toHaveLength(10);
  });
  it("gives every TLS section a unique id and a valid depth", () => {
    const sections = getTopic("tls-https-certificates")!.sections;
    const ids = sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of sections) {
      expect(["fundamentals", "interview-ready", "advanced"]).toContain(s.depth);
    }
  });
```

- [ ] **Step 6: Verify** — `npm test -- topic-registry` (PASS), `npm run typecheck`, `npm run lint`, `npm run build` (must generate `/topics/security/tls-https-certificates`). All green.

- [ ] **Step 7: Commit**
```bash
git add lib/topic-registry.ts "app/topics/[category]/[slug]/page.tsx" lib/topics.ts content/topics/tls-https-certificates.mdx tests/topic-registry.test.ts
git commit -m "feat: register TLS topic route and skeleton"
```

---

### Task 4: Content — sections 1–5 (Opus orchestrator authors)

**Files:** Modify `content/topics/tls-https-certificates.mdx` (replace placeholders for `overview`, `symmetric-asymmetric`, `tls-handshake`, `capacity-estimates`, `certificates-pki`).

Author interview-grade prose matching `content/topics/authentication.mdx`'s voice/density. Requirements:
- **overview:** TLS makes connections secure; HTTPS = HTTP over TLS; the three guarantees (confidentiality, integrity, authentication). `Callout variant="info"`.
- **symmetric-asymmetric:** symmetric (fast, shared key, bulk data) vs asymmetric (key pair, slow, solves key distribution); the "agree a key over a watched channel" problem; TLS is hybrid. ≥1 `<KnowledgeCheck>`.
- **tls-handshake:** negotiate version/cipher, server cert, ephemeral DH key exchange → shared session key → forward secrecy; TLS 1.3 1-RTT vs 1.2. Embed `<TlsHandshakeSequence />`. ≥1 `<KnowledgeCheck>`.
- **capacity-estimates:** embed `<TlsCapacity assumptions={{ newConnectionsPerSec: 50000, fullHandshakeCpuMs: 2, resumedHandshakeCpuMs: 0.1, resumptionRate: 0.8, msPerCorePerSec: 1000 }} />` (must match the estimates test exactly). Prose: handshake CPU dominates; resumption cuts ~100 → ~24 cores; sized by handshakes not bytes.
- **certificates-pki:** X.509 binds domain→public key, signed by a CA; leaf ← intermediate ← root in the trust store; client validates the chain + hostname + expiry; this is PKI. Embed `<CertValidationSequence />`. ≥1 `<KnowledgeCheck>`.

- [ ] **Step 1:** Replace the five placeholders with authored content.
- [ ] **Step 2:** `npm run build` → succeeds.
- [ ] **Step 3:** Commit deferred to Task 5.

---

### Task 5: Content — sections 6–10 + content test (Opus orchestrator authors)

**Files:** Modify `content/topics/tls-https-certificates.mdx` (`certificate-lifecycle`, `https-in-practice`, `tls-termination`, `pitfalls-best-practices`, `knowledge-checks-faq`); Create `tests/tls-content.test.ts`.

Requirements:
- **certificate-lifecycle:** DV/OV/EV; ACME/Let's Encrypt auto-renewal; expiry outages; revocation via CRL / OCSP / OCSP stapling.
- **https-in-practice:** SNI, ALPN, HSTS, http→https redirect, mixed content. ≥1 `<KnowledgeCheck>`.
- **tls-termination:** terminate at the edge (LB/reverse-proxy/CDN); termination vs passthrough vs re-encryption; mTLS (both sides present certs) for service-to-service / zero-trust. A `TradeoffTable` for termination modes fits well. ≥1 `<KnowledgeCheck>`.
- **pitfalls-best-practices:** `Callout variant="warning"` — expired certs/automate renewal, weak protocol versions/ciphers, self-signed/untrusted chains, hostname validation, downgrade/stripping + HSTS, protect the private key, prefer TLS 1.3 + forward secrecy. A `DecisionRecord` with the default recommendation.
- **knowledge-checks-faq:** reach **≥ 4 `<KnowledgeCheck>` total** across the page, plus a `<Faq items={[…]} />` with **≥ 10** entries covering the spine.

- [ ] **Step 1:** Author the five sections.
- [ ] **Step 2: Create `tests/tls-content.test.ts`**
```ts
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/topics/tls-https-certificates.mdx", "utf8");

const requiredIds = [
  "overview",
  "symmetric-asymmetric",
  "tls-handshake",
  "capacity-estimates",
  "certificates-pki",
  "certificate-lifecycle",
  "https-in-practice",
  "tls-termination",
  "pitfalls-best-practices",
  "knowledge-checks-faq",
];

describe("TLS topic content", () => {
  it("contains every required section anchor", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });
  it("embeds the capacity model and both flow diagrams", () => {
    for (const tag of ["<TlsCapacity", "<TlsHandshakeSequence", "<CertValidationSequence"]) {
      expect(content).toContain(tag);
    }
  });
  it("includes at least four knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
  it("includes at least ten FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(10);
  });
});
```

- [ ] **Step 3: Verify** — `npm test -- tls-content`, then `npm run build`, `npm test`, `npm run typecheck`, `npm run lint`. All green.
- [ ] **Step 4: Commit**
```bash
git add content/topics/tls-https-certificates.mdx tests/tls-content.test.ts
git commit -m "content: complete TLS/HTTPS and Certificates topic"
```

---

### Task 6: E2e + final verification

**Files:** Modify `e2e/pilot.spec.ts` (append one test).

- [ ] **Step 1: Append the e2e test**
```ts
test("learner can open the TLS security topic", async ({ page }) => {
  await page.goto("/topics");
  await page.getByRole("link", { name: /tls\/https and certificates/i }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: /tls\/https and certificates/i }),
  ).toBeVisible();
  // Navigate to a section via URL fragment (TOC is hidden on mobile viewports)
  await page.goto("/topics/security/tls-https-certificates#tls-handshake");
  await expect(page.locator("#tls-handshake")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /tls handshake establishing an encrypted session/i }).first(),
  ).toBeVisible();
});
```

- [ ] **Step 2: Run e2e** — `npm run test:e2e` (desktop + mobile) → all pass.
- [ ] **Step 3: Full verification gates** — `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (confirm `/topics/security/tls-https-certificates`), `git diff --check`. All green.
- [ ] **Step 4: Commit**
```bash
git add e2e/pilot.spec.ts
git commit -m "test: verify TLS topic flow end-to-end"
```

---

## Self-Review

- **Spec coverage:** scope/cross-refs → Tasks 4–5 notes; capacity model → Task 1; two diagrams → Task 2; registry/route/card/skeleton → Task 3; 10-section content → Tasks 4–5; testing (registry, content, estimates, diagrams, e2e) → Tasks 1,2,3,5,6. All covered.
- **Placeholder scan:** content Tasks 4–5 describe sections (Opus-authored) but pin every embed, component, and count; mechanical tasks carry full code. No stray TODO/TBD.
- **Type consistency:** `calculateTlsCapacity`/`TlsCapacity`/`TlsHandshakeSequence`/`CertValidationSequence` used identically across tasks; capacity assumptions identical in estimates test, wrapper, MDX embed, and content test.
- **Count check:** adding a topic leaves the curriculum problem count at 33 — no curriculum/e2e count edits.
