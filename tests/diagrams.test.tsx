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
