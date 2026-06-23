import type { MDXComponents } from "mdx/types";
import { Callout } from "@/components/learning/callout";
import { RequirementsTable } from "@/components/learning/requirements-table";
import { CapacityModel } from "@/components/learning/capacity-model";
import { ApiContract } from "@/components/learning/api-contract";
import { EntityModel } from "@/components/learning/entity-model";
import { TradeoffTable } from "@/components/learning/tradeoff-table";
import { DecisionRecord } from "@/components/learning/decision-record";
import { FailureMatrix } from "@/components/learning/failure-matrix";
import { DepthSection } from "@/components/learning/depth-section";
import { Faq } from "@/components/learning/faq";
import { KnowledgeCheck } from "@/components/learning/knowledge-check";
import { RateLimiterCapacity } from "@/components/learning/rate-limiter-capacity";
import { PastebinCapacity } from "@/components/learning/pastebin-capacity";
import { NotificationCapacity } from "@/components/learning/notification-capacity";
import { TicketBookingCapacity } from "@/components/learning/ticket-booking-capacity";
import { ArchitectureDiagram } from "@/components/diagrams/architecture-diagram";
import {
  CreateUrlSequence,
  RedirectCacheHitSequence,
  RedirectCacheMissSequence,
  AnalyticsSequence,
} from "@/components/diagrams/request-flow-diagrams";
import { ScaleEvolution } from "@/components/diagrams/scale-evolution";
import { RateLimitVisualizer } from "@/components/diagrams/rate-limit-visualizer";
import { RateLimiterArchitecture } from "@/components/diagrams/rate-limiter-architecture";
import {
  AllowSequence,
  ThrottleSequence,
  FailOpenSequence,
} from "@/components/diagrams/rate-limit-flows";
import { PastebinArchitecture } from "@/components/diagrams/pastebin-architecture";
import {
  CreatePasteSequence,
  ReadCacheHitSequence,
  ReadCacheMissSequence,
  ExpirySequence,
} from "@/components/diagrams/paste-flows";
import { NotificationArchitecture } from "@/components/diagrams/notification-architecture";
import {
  SendFanoutSequence,
  RetryBackoffSequence,
  DeadLetterSequence,
  IdempotentSendSequence,
} from "@/components/diagrams/notification-flows";
import { TicketBookingArchitecture } from "@/components/diagrams/ticket-booking-architecture";
import {
  HoldSeatSequence,
  ContentionSequence,
  ConfirmPaymentSequence,
  HoldExpirySequence,
} from "@/components/diagrams/booking-flows";

/**
 * Global MDX component map. Custom teaching components and diagrams are
 * registered here so tutorial authors can use them by name without per-file
 * imports. Base markdown elements inherit styling from the `.prose-tutorial`
 * wrapper in globals.css.
 */
const teachingComponents = {
  Callout,
  RequirementsTable,
  CapacityModel,
  ApiContract,
  EntityModel,
  TradeoffTable,
  DecisionRecord,
  FailureMatrix,
  DepthSection,
  Faq,
  KnowledgeCheck,
  RateLimiterCapacity,
  PastebinCapacity,
  NotificationCapacity,
  TicketBookingCapacity,
  ArchitectureDiagram,
  CreateUrlSequence,
  RedirectCacheHitSequence,
  RedirectCacheMissSequence,
  AnalyticsSequence,
  ScaleEvolution,
  RateLimitVisualizer,
  RateLimiterArchitecture,
  AllowSequence,
  ThrottleSequence,
  FailOpenSequence,
  PastebinArchitecture,
  CreatePasteSequence,
  ReadCacheHitSequence,
  ReadCacheMissSequence,
  ExpirySequence,
  NotificationArchitecture,
  SendFanoutSequence,
  RetryBackoffSequence,
  DeadLetterSequence,
  IdempotentSendSequence,
  TicketBookingArchitecture,
  HoldSeatSequence,
  ContentionSequence,
  ConfirmPaymentSequence,
  HoldExpirySequence,
};

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...teachingComponents,
    ...components,
  };
}
