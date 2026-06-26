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
import { VideoStreamingCapacity } from "@/components/learning/video-streaming-capacity";
import { CollaborativeDocEditorCapacity } from "@/components/learning/collaborative-doc-editor-capacity";
import { DistributedCacheCapacity } from "@/components/learning/distributed-cache-capacity";
import { CloudDriveCapacity } from "@/components/learning/cloud-drive-capacity";
import { PaymentSystemCapacity } from "@/components/learning/payment-system-capacity";
import { DistributedLoggingCapacity } from "@/components/learning/distributed-logging-capacity";
import { DistributedJobSchedulerCapacity } from "@/components/learning/distributed-job-scheduler-capacity";
import { MapsNavigationCapacity } from "@/components/learning/maps-navigation-capacity";
import { ApiGatewayCapacity } from "@/components/learning/api-gateway-capacity";
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
import { VideoStreamingArchitecture } from "@/components/diagrams/video-streaming-architecture";
import {
  UploadIngestSequence,
  TranscodePipelineSequence,
  AbrPlaybackSequence,
  CdnDeliverySequence,
} from "@/components/diagrams/streaming-flows";
import { CollaborativeDocEditorArchitecture } from "@/components/diagrams/collaborative-doc-editor-architecture";
import {
  EditBroadcastSequence,
  ConflictResolutionSequence,
  PresenceSequence,
  ReconnectSyncSequence,
} from "@/components/diagrams/collab-editor-flows";
import { DistributedCacheArchitecture } from "@/components/diagrams/distributed-cache-architecture";
import {
  CacheHitSequence,
  CacheMissSequence,
  NodeRebalanceSequence,
  StampedeSequence,
} from "@/components/diagrams/cache-flows";
import { CloudDriveArchitecture } from "@/components/diagrams/cloud-drive-architecture";
import {
  FileUploadSequence,
  DeltaSyncSequence,
  ChangeNotificationSequence,
  ConflictSequence,
} from "@/components/diagrams/cloud-drive-flows";
import { PaymentSystemArchitecture } from "@/components/diagrams/payment-system-architecture";
import {
  AuthCaptureSequence,
  IdempotentRetrySequence,
  ReconciliationSequence,
  RefundSequence,
} from "@/components/diagrams/payment-flows";
import { DistributedLoggingArchitecture } from "@/components/diagrams/distributed-logging-architecture";
import {
  LogIngestSequence,
  IndexBuildSequence,
  SearchQuerySequence,
  RetentionTierSequence,
} from "@/components/diagrams/logging-flows";
import { DistributedJobSchedulerArchitecture } from "@/components/diagrams/distributed-job-scheduler-architecture";
import {
  ScheduleJobSequence,
  DispatchExecuteSequence,
  LeaseRecoverySequence,
  RetryBackoffSequence as JobSchedulerRetryBackoffSequence,
} from "@/components/diagrams/job-scheduler-flows";
import { MapsNavigationArchitecture } from "@/components/diagrams/maps-navigation-architecture";
import {
  RouteQuerySequence,
  MapMatchSequence,
  TrafficUpdateSequence,
  TileFetchSequence,
} from "@/components/diagrams/maps-navigation-flows";
import { ApiGatewayArchitecture } from "@/components/diagrams/api-gateway-architecture";
import {
  ProxyRequestSequence,
  AuthRejectSequence,
  ConfigPushSequence,
  CircuitBreakSequence,
} from "@/components/diagrams/api-gateway-flows";

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
  VideoStreamingCapacity,
  CollaborativeDocEditorCapacity,
  DistributedCacheCapacity,
  CloudDriveCapacity,
  PaymentSystemCapacity,
  DistributedLoggingCapacity,
  DistributedJobSchedulerCapacity,
  MapsNavigationCapacity,
  ApiGatewayCapacity,
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
  VideoStreamingArchitecture,
  UploadIngestSequence,
  TranscodePipelineSequence,
  AbrPlaybackSequence,
  CdnDeliverySequence,
  CollaborativeDocEditorArchitecture,
  EditBroadcastSequence,
  ConflictResolutionSequence,
  PresenceSequence,
  ReconnectSyncSequence,
  DistributedCacheArchitecture,
  CacheHitSequence,
  CacheMissSequence,
  NodeRebalanceSequence,
  StampedeSequence,
  CloudDriveArchitecture,
  FileUploadSequence,
  DeltaSyncSequence,
  ChangeNotificationSequence,
  ConflictSequence,
  PaymentSystemArchitecture,
  AuthCaptureSequence,
  IdempotentRetrySequence,
  ReconciliationSequence,
  RefundSequence,
  DistributedLoggingArchitecture,
  LogIngestSequence,
  IndexBuildSequence,
  SearchQuerySequence,
  RetentionTierSequence,
  DistributedJobSchedulerArchitecture,
  ScheduleJobSequence,
  DispatchExecuteSequence,
  LeaseRecoverySequence,
  JobSchedulerRetryBackoffSequence,
  MapsNavigationArchitecture,
  RouteQuerySequence,
  MapMatchSequence,
  TrafficUpdateSequence,
  TileFetchSequence,
  ApiGatewayArchitecture,
  ProxyRequestSequence,
  AuthRejectSequence,
  ConfigPushSequence,
  CircuitBreakSequence,
};

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...teachingComponents,
    ...components,
  };
}
