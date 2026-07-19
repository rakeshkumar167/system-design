import { expect, test } from "@playwright/test";

test("learner can discover and read the pilot tutorial", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /learn system design/i }),
  ).toBeVisible();

  await page.getByRole("link", { name: /start url shortener/i }).first().click();
  await expect(
    page.getByRole("heading", { name: /design a url shortener/i }),
  ).toBeVisible();

  // The architecture diagram is reachable and exposes accessible meaning.
  await page.getByText(/redirect service reads cache first/i).scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("img", { name: /url shortener architecture/i }),
  ).toBeVisible();
});

test("knowledge checks reveal an explanation after a choice", async ({ page }) => {
  await page.goto("/learn/url-shortener");
  const option = page.getByRole("button", { name: /single-flight/i }).first();
  await option.scrollIntoViewIfNeeded();
  await option.click();
  await expect(page.getByText(/single-flight collapses/i)).toBeVisible();
});

test("curriculum separates available and upcoming content", async ({ page }) => {
  await page.goto("/curriculum");
  await expect(page.getByText(/^coming soon$/i)).toHaveCount(13);

  await page.getByLabel(/search problems/i).fill("payment");
  await expect(
    page.getByRole("heading", { name: "Payment System" }),
  ).toBeVisible();
  await expect(page.getByText(/showing 1 of 33/i)).toBeVisible();
});

test("learner can open the pastebin tutorial", async ({ page }) => {
  await page.goto("/learn/pastebin");
  await expect(
    page.getByRole("heading", { name: /design a pastebin/i }),
  ).toBeVisible();
  // Navigate to the section via URL fragment (TOC is hidden on mobile viewports)
  await page.goto("/learn/pastebin#expiry-and-ttl");
  await expect(page.locator("#expiry-and-ttl")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /pastebin architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the notification service tutorial", async ({ page }) => {
  await page.goto("/learn/notification-service");
  await expect(
    page.getByRole("heading", { name: /design a notification service/i }),
  ).toBeVisible();
  await page.goto("/learn/notification-service#delivery-guarantees");
  await expect(page.locator("#delivery-guarantees")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /notification architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the ticket booking tutorial", async ({ page }) => {
  await page.goto("/learn/ticket-booking");
  await expect(
    page.getByRole("heading", { name: /design a ticket booking system/i }),
  ).toBeVisible();
  await page.goto("/learn/ticket-booking#concurrency-control");
  await expect(page.locator("#concurrency-control")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /ticket booking architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the video streaming tutorial", async ({ page }) => {
  await page.goto("/learn/video-streaming");
  await expect(
    page.getByRole("heading", { name: /design a video streaming platform/i }),
  ).toBeVisible();
  await page.goto("/learn/video-streaming#transcoding-pipeline");
  await expect(page.locator("#transcoding-pipeline")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /video streaming architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the authentication security topic", async ({ page }) => {
  await page.goto("/topics");
  await page.getByRole("link", { name: /authentication/i }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: /^authentication$/i }),
  ).toBeVisible();
  // Navigate to a section via URL fragment (TOC is hidden on mobile viewports)
  await page.goto("/topics/security/authentication#oauth2-delegated");
  await expect(page.locator("#oauth2-delegated")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /authorization-code flow with pkce/i }).first(),
  ).toBeVisible();
});

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

test("learner can open the authorization security topic", async ({ page }) => {
  await page.goto("/topics");
  await page.getByRole("link", { name: /authorization/i }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: /^authorization$/i }),
  ).toBeVisible();
  // Navigate to a section via URL fragment (TOC is hidden on mobile viewports)
  await page.goto("/topics/security/authorization#policy-architecture");
  await expect(page.locator("#policy-architecture")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /an externalized authorization decision/i }).first(),
  ).toBeVisible();
});

test("learner can open the password hashing security topic", async ({ page }) => {
  await page.goto("/topics");
  await page.getByRole("link", { name: /password hashing/i }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: /^password hashing$/i }),
  ).toBeVisible();
  // Navigate to a section via URL fragment (TOC is hidden on mobile viewports)
  await page.goto("/topics/security/password-hashing#slow-hashing");
  await expect(page.locator("#slow-hashing")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /hashing a password at registration/i }).first(),
  ).toBeVisible();
});

test("learner can open the encryption and key management security topic", async ({ page }) => {
  await page.goto("/topics");
  await page.getByRole("link", { name: /encryption and key management/i }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: /^encryption & key management$/i }),
  ).toBeVisible();
  // Navigate to a section via URL fragment (TOC is hidden on mobile viewports)
  await page.goto("/topics/security/encryption-key-management#envelope-encryption");
  // Assert the embedded diagram first so layout settles before the viewport check.
  await expect(
    page.getByRole("img", { name: /encrypting data with envelope encryption/i }).first(),
  ).toBeVisible();
  await expect(page.locator("#envelope-encryption")).toBeInViewport();
});

test("learner can open the OWASP Top 10 security topic", async ({ page }) => {
  await page.goto("/topics");
  await page.getByRole("link", { name: /owasp top 10/i }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: /^owasp top 10$/i }),
  ).toBeVisible();
  // Navigate to a section via URL fragment (TOC is hidden on mobile viewports)
  await page.goto("/topics/security/owasp-top-10#injection");
  // Assert the embedded diagram first so layout settles before the viewport check.
  await expect(
    page.getByRole("img", { name: /a SQL injection attack/i }).first(),
  ).toBeVisible();
  await expect(page.locator("#injection")).toBeInViewport();
});

test("learner can open the API security topic", async ({ page }) => {
  await page.goto("/topics");
  await page.getByRole("link", { name: /api security/i }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: /^api security$/i }),
  ).toBeVisible();
  // Navigate to a section via URL fragment (TOC is hidden on mobile viewports)
  await page.goto("/topics/security/api-security#authorizing-requests");
  // Assert the embedded diagram first so layout settles before the viewport check.
  await expect(
    page.getByRole("img", { name: /a broken object-level authorization \(BOLA\) attack/i }).first(),
  ).toBeVisible();
  await expect(page.locator("#authorizing-requests")).toBeInViewport();
});

test("learner can open the session management security topic", async ({ page }) => {
  await page.goto("/topics");
  await page.getByRole("link", { name: /session management/i }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: /^session management$/i }),
  ).toBeVisible();
  // Navigate to a section via URL fragment (TOC is hidden on mobile viewports)
  await page.goto("/topics/security/session-management#session-attacks");
  // Assert the embedded diagram first so layout settles before the viewport check.
  await expect(
    page.getByRole("img", { name: /a session fixation attack/i }).first(),
  ).toBeVisible();
  await expect(page.locator("#session-attacks")).toBeInViewport();
});

test("learner can open the secure SDLC security topic", async ({ page }) => {
  await page.goto("/topics");
  await page.getByRole("link", { name: /secure sdlc/i }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: /^secure sdlc$/i }),
  ).toBeVisible();
  // Navigate to a section via URL fragment (TOC is hidden on mobile viewports)
  await page.goto("/topics/security/secure-sdlc#supply-chain");
  // Assert the embedded diagram first so layout settles before the viewport check.
  await expect(
    page.getByRole("img", { name: /security gates in the CI\/CD pipeline/i }).first(),
  ).toBeVisible();
  await expect(page.locator("#supply-chain")).toBeInViewport();
});

test("theme toggle switches between light and dark", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  const initiallyDark = await html.evaluate((el) => el.classList.contains("dark"));
  await page.getByRole("button", { name: /toggle color theme/i }).click();
  await expect
    .poll(() => html.evaluate((el) => el.classList.contains("dark")))
    .toBe(!initiallyDark);
});

test("learner can open the collaborative doc editor tutorial", async ({ page }) => {
  await page.goto("/learn/collaborative-doc-editor");
  await expect(
    page.getByRole("heading", { name: /design a collaborative document editor/i }),
  ).toBeVisible();
  await page.goto("/learn/collaborative-doc-editor#crdts");
  await expect(page.locator("#crdts")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /collaborative (document )?editor architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the distributed cache tutorial", async ({ page }) => {
  await page.goto("/learn/distributed-cache");
  await expect(
    page.getByRole("heading", { name: /design a distributed cache/i }),
  ).toBeVisible();
  await page.goto("/learn/distributed-cache#consistent-hashing");
  await expect(page.locator("#consistent-hashing")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /distributed cache architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the cloud drive tutorial", async ({ page }) => {
  await page.goto("/learn/cloud-drive");
  await expect(
    page.getByRole("heading", { name: /design a cloud drive/i }),
  ).toBeVisible();
  await page.goto("/learn/cloud-drive#delta-sync");
  await expect(page.locator("#delta-sync")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /cloud drive architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the payment system tutorial", async ({ page }) => {
  await page.goto("/learn/payment-system");
  await expect(
    page.getByRole("heading", { name: /design a payment system/i }),
  ).toBeVisible();
  await page.goto("/learn/payment-system#double-entry-ledger");
  await expect(page.locator("#double-entry-ledger")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /payment system architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the distributed logging tutorial", async ({ page }) => {
  await page.goto("/learn/distributed-logging");
  await expect(
    page.getByRole("heading", { name: /design a distributed logging platform/i }),
  ).toBeVisible();
  await page.goto("/learn/distributed-logging#indexing");
  await expect(page.locator("#indexing")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /distributed logging architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the distributed job scheduler tutorial", async ({ page }) => {
  await page.goto("/learn/distributed-job-scheduler");
  await expect(
    page.getByRole("heading", { name: /design a distributed job scheduler/i }),
  ).toBeVisible();
  await page.goto("/learn/distributed-job-scheduler#leasing-coordination");
  await expect(page.locator("#leasing-coordination")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /job scheduler architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the maps and navigation tutorial", async ({ page }) => {
  await page.goto("/learn/maps-navigation");
  await expect(
    page.getByRole("heading", { name: /design maps and navigation/i }),
  ).toBeVisible();
  await page.goto("/learn/maps-navigation#precomputation");
  await expect(page.locator("#precomputation")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /maps (and )?navigation architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the api gateway tutorial", async ({ page }) => {
  await page.goto("/learn/api-gateway");
  await expect(
    page.getByRole("heading", { name: /design an api gateway/i }),
  ).toBeVisible();
  await page.goto("/learn/api-gateway#control-data-plane");
  await expect(page.locator("#control-data-plane")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /api gateway architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the web crawler tutorial", async ({ page }) => {
  await page.goto("/learn/web-crawler");
  await expect(
    page.getByRole("heading", { name: /design a web crawler/i }),
  ).toBeVisible();
  await page.goto("/learn/web-crawler#url-frontier");
  await expect(page.locator("#url-frontier")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /web crawler architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the search autocomplete tutorial", async ({ page }) => {
  await page.goto("/learn/search-autocomplete");
  await expect(
    page.getByRole("heading", { name: /design search autocomplete/i }),
  ).toBeVisible();
  await page.goto("/learn/search-autocomplete#trie-topk");
  await expect(page.locator("#trie-topk")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /search autocomplete architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the news feed tutorial", async ({ page }) => {
  await page.goto("/learn/news-feed");
  await expect(
    page.getByRole("heading", { name: /design a news feed/i }),
  ).toBeVisible();
  await page.goto("/learn/news-feed#fanout-models");
  await expect(page.locator("#fanout-models")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /news feed architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the chat system tutorial", async ({ page }) => {
  await page.goto("/learn/chat-system");
  await expect(
    page.getByRole("heading", { name: /design a chat system/i }),
  ).toBeVisible();
  await page.goto("/learn/chat-system#connection-layer");
  await expect(page.locator("#connection-layer")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /chat system architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the leaderboard tutorial", async ({ page }) => {
  await page.goto("/learn/leaderboard");
  await expect(
    page.getByRole("heading", { name: /design a leaderboard/i }),
  ).toBeVisible();
  await page.goto("/learn/leaderboard#high-level-architecture");
  // Assert the embedded diagram first so layout settles before the viewport check.
  await expect(
    page.getByRole("img", { name: /leaderboard architecture/i }).first(),
  ).toBeVisible();
  await expect(page.locator("#high-level-architecture")).toBeInViewport();
});

test("learner can open the metrics and monitoring tutorial", async ({ page }) => {
  await page.goto("/learn/metrics-monitoring");
  await expect(
    page.getByRole("heading", { name: /design a metrics and monitoring system/i }),
  ).toBeVisible();
  await page.goto("/learn/metrics-monitoring#high-level-architecture");
  // Assert the embedded diagram first so layout settles before the viewport check.
  await expect(
    page.getByRole("img", { name: /metrics and monitoring architecture/i }).first(),
  ).toBeVisible();
  await expect(page.locator("#high-level-architecture")).toBeInViewport();
});
