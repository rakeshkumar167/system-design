import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ArchitectureDiagram } from "@/components/diagrams/architecture-diagram";
import { ScaleEvolution } from "@/components/diagrams/scale-evolution";

describe("ArchitectureDiagram", () => {
  it("exposes the architecture meaning to non-visual readers", () => {
    render(<ArchitectureDiagram />);
    expect(
      screen.getByRole("img", { name: /url shortener architecture/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/redirect service reads cache first/i),
    ).toBeInTheDocument();
  });
});

describe("ScaleEvolution", () => {
  it("describes four scaling stages", () => {
    render(<ScaleEvolution />);
    expect(screen.getByRole("img", { name: /scaling evolution/i })).toBeInTheDocument();
  });
});

import { RateLimiterArchitecture } from "@/components/diagrams/rate-limiter-architecture";
import {
  AllowSequence,
  ThrottleSequence,
  FailOpenSequence,
} from "@/components/diagrams/rate-limit-flows";

describe("RateLimiterArchitecture", () => {
  it("exposes the limiter architecture to non-visual readers", () => {
    render(<RateLimiterArchitecture />);
    expect(
      screen.getByRole("img", { name: /rate limiter architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/fail open/i)).toBeInTheDocument();
  });
});

describe("rate limit flow sequences", () => {
  it("renders the allow, throttle, and fail-open sequences", () => {
    render(<AllowSequence />);
    expect(screen.getByRole("img", { name: /allow/i })).toBeInTheDocument();
    render(<ThrottleSequence />);
    expect(screen.getByRole("img", { name: /throttle|429/i })).toBeInTheDocument();
    render(<FailOpenSequence />);
    expect(screen.getByRole("img", { name: /fail.?open/i })).toBeInTheDocument();
  });
});

import { PastebinArchitecture } from "@/components/diagrams/pastebin-architecture";
import {
  CreatePasteSequence,
  ReadCacheHitSequence,
  ReadCacheMissSequence,
  ExpirySequence,
} from "@/components/diagrams/paste-flows";

describe("PastebinArchitecture", () => {
  it("exposes the pastebin architecture to non-visual readers", () => {
    render(<PastebinArchitecture />);
    expect(
      screen.getByRole("img", { name: /pastebin architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/object storage/i)).toBeInTheDocument();
  });
});

describe("paste flow sequences", () => {
  it("renders the create, read-hit, read-miss, and expiry sequences", () => {
    render(<CreatePasteSequence />);
    expect(screen.getByRole("img", { name: /creat/i })).toBeInTheDocument();
    render(<ReadCacheHitSequence />);
    expect(screen.getByRole("img", { name: /cache hit/i })).toBeInTheDocument();
    render(<ReadCacheMissSequence />);
    expect(screen.getByRole("img", { name: /cache miss/i })).toBeInTheDocument();
    render(<ExpirySequence />);
    expect(screen.getByRole("img", { name: /expir/i })).toBeInTheDocument();
  });
});

import { NotificationArchitecture } from "@/components/diagrams/notification-architecture";
import {
  SendFanoutSequence,
  RetryBackoffSequence,
  DeadLetterSequence,
  IdempotentSendSequence,
} from "@/components/diagrams/notification-flows";

describe("NotificationArchitecture", () => {
  it("exposes the notification architecture to non-visual readers", () => {
    render(<NotificationArchitecture />);
    expect(
      screen.getByRole("img", { name: /notification architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/dead.?letter/i)).toBeInTheDocument();
  });
});

describe("notification flow sequences", () => {
  it("renders the fan-out, retry, dead-letter, and idempotent sequences", () => {
    render(<SendFanoutSequence />);
    expect(screen.getByRole("img", { name: /fan.?out/i })).toBeInTheDocument();
    render(<RetryBackoffSequence />);
    expect(screen.getByRole("img", { name: /retry|backoff/i })).toBeInTheDocument();
    render(<DeadLetterSequence />);
    expect(screen.getByRole("img", { name: /dead.?letter/i })).toBeInTheDocument();
    render(<IdempotentSendSequence />);
    expect(screen.getByRole("img", { name: /idempoten|duplicate/i })).toBeInTheDocument();
  });
});
