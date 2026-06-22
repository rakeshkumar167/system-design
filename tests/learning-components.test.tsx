import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Faq } from "@/components/learning/faq";
import { KnowledgeCheck } from "@/components/learning/knowledge-check";

describe("Faq", () => {
  it("renders answers through native accessible disclosure", () => {
    render(
      <Faq items={[{ question: "Why Base62?", answer: "It keeps tokens compact." }]} />,
    );
    expect(screen.getByText("Why Base62?").closest("summary")).toBeTruthy();
    expect(screen.getByText("It keeps tokens compact.")).toBeInTheDocument();
  });
});

describe("KnowledgeCheck", () => {
  it("explains the answer after a selection", () => {
    render(
      <KnowledgeCheck
        question="Where should click analytics run?"
        options={["Inline with the redirect", "Asynchronously"]}
        answer={1}
        explanation="Redirect latency stays independent of analytics."
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Asynchronously" }));
    expect(
      screen.getByText(/redirect latency stays independent/i),
    ).toBeVisible();
  });

  it("marks an incorrect selection without revealing it as correct", () => {
    render(
      <KnowledgeCheck
        question="Where should click analytics run?"
        options={["Inline with the redirect", "Asynchronously"]}
        answer={1}
        explanation="Redirect latency stays independent of analytics."
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Inline with the redirect" }),
    );
    expect(screen.getByText(/not quite/i)).toBeInTheDocument();
  });
});
