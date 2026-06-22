import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import HomePage from "@/app/page";

describe("home page", () => {
  it("presents the pilot and its primary learning action", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { name: /master system design/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /start url shortener/i }),
    ).toHaveAttribute("href", "/learn/url-shortener");
  });
});
