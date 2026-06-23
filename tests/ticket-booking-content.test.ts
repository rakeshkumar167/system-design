import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const content = readFileSync("content/tutorials/ticket-booking.mdx", "utf8");

const requiredIds = [
  "interview-framing",
  "requirements",
  "capacity-estimates",
  "entity-model",
  "api-design",
  "high-level-architecture",
  "detailed-flows",
  "reservation-lifecycle",
  "concurrency-control",
  "strong-consistency",
  "payment-saga",
  "high-contention",
  "scalability-evolution",
  "resiliency-failure-modes",
  "security-abuse",
  "tradeoffs-alternatives",
  "interview-summary",
  "knowledge-checks-faq",
];

describe("Ticket Booking content", () => {
  it("contains every required section anchor", () => {
    for (const id of requiredIds) {
      expect(content).toContain(`id="${id}"`);
    }
  });

  it("embeds the capacity model and architecture diagram", () => {
    for (const tag of ["<TicketBookingCapacity", "<TicketBookingArchitecture"]) {
      expect(content).toContain(tag);
    }
  });

  it("embeds the flow sequence diagrams", () => {
    for (const tag of [
      "<HoldSeatSequence",
      "<ContentionSequence",
      "<ConfirmPaymentSequence",
      "<HoldExpirySequence",
    ]) {
      expect(content).toContain(tag);
    }
  });

  it("includes at least six knowledge checks", () => {
    expect((content.match(/<KnowledgeCheck/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("includes at least twelve FAQ questions", () => {
    expect((content.match(/question:/g) ?? []).length).toBeGreaterThanOrEqual(12);
  });
});
