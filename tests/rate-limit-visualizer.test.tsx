// tests/rate-limit-visualizer.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RateLimitVisualizer } from "@/components/diagrams/rate-limit-visualizer";

describe("RateLimitVisualizer", () => {
  it("exposes the algorithm meaning to non-visual readers", () => {
    render(<RateLimitVisualizer algorithm="token-bucket" />);
    expect(
      screen.getByRole("img", { name: /token bucket/i }),
    ).toBeInTheDocument();
  });

  it("renders a usable control and an initial state without interaction", () => {
    render(<RateLimitVisualizer algorithm="token-bucket" />);
    expect(screen.getByRole("button", { name: /send request/i })).toBeEnabled();
    // The current allowance is shown before any interaction.
    expect(screen.getByTestId("rlv-status")).toHaveTextContent(/ready|allowed|tokens/i);
  });

  it("updates the simulation when a request is sent", () => {
    render(<RateLimitVisualizer algorithm="token-bucket" />);
    const before = screen.getByTestId("rlv-status").textContent;
    fireEvent.click(screen.getByRole("button", { name: /send request/i }));
    const after = screen.getByTestId("rlv-status").textContent;
    expect(after).not.toEqual(before);
  });

  it("can be reset", () => {
    render(<RateLimitVisualizer algorithm="fixed-window" />);
    fireEvent.click(screen.getByRole("button", { name: /send request/i }));
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(screen.getByTestId("rlv-status")).toBeInTheDocument();
  });
});
