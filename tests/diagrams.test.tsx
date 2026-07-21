import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { VideoStreamingArchitecture } from "@/components/diagrams/video-streaming-architecture";
import { DistributedCacheArchitecture } from "@/components/diagrams/distributed-cache-architecture";
import {
  CacheHitSequence,
  CacheMissSequence,
  NodeRebalanceSequence,
  StampedeSequence,
} from "@/components/diagrams/cache-flows";
import { CollaborativeDocEditorArchitecture } from "@/components/diagrams/collaborative-doc-editor-architecture";
import {
  EditBroadcastSequence,
  ConflictResolutionSequence,
  PresenceSequence,
  ReconnectSyncSequence,
} from "@/components/diagrams/collab-editor-flows";
import {
  UploadIngestSequence,
  TranscodePipelineSequence,
  AbrPlaybackSequence,
  CdnDeliverySequence,
} from "@/components/diagrams/streaming-flows";
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

import { TicketBookingArchitecture } from "@/components/diagrams/ticket-booking-architecture";
import {
  HoldSeatSequence,
  ContentionSequence,
  ConfirmPaymentSequence,
  HoldExpirySequence,
} from "@/components/diagrams/booking-flows";

describe("TicketBookingArchitecture", () => {
  it("exposes the ticket booking architecture to non-visual readers", () => {
    render(<TicketBookingArchitecture />);
    expect(
      screen.getByRole("img", { name: /ticket booking architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/oversell/i)).toBeInTheDocument();
  });
});

describe("booking flow sequences", () => {
  it("renders the hold, contention, confirm, and expiry sequences", () => {
    render(<HoldSeatSequence />);
    expect(screen.getByRole("img", { name: /hold/i })).toBeInTheDocument();
    render(<ContentionSequence />);
    expect(screen.getByRole("img", { name: /contention|race|conflict/i })).toBeInTheDocument();
    render(<ConfirmPaymentSequence />);
    expect(screen.getByRole("img", { name: /confirm|payment/i })).toBeInTheDocument();
    render(<HoldExpirySequence />);
    expect(screen.getByRole("img", { name: /expir/i })).toBeInTheDocument();
  });
});

describe("VideoStreamingArchitecture", () => {
  it("exposes the video streaming architecture to non-visual readers", () => {
    render(<VideoStreamingArchitecture />);
    expect(
      screen.getByRole("img", { name: /video streaming architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/adaptive bitrate/i)).toBeInTheDocument();
  });
});

describe("streaming flow sequences", () => {
  it("renders the upload, transcode, playback, and CDN sequences", () => {
    render(<UploadIngestSequence />);
    expect(screen.getByRole("img", { name: /upload|ingest/i })).toBeInTheDocument();
    render(<TranscodePipelineSequence />);
    expect(screen.getByRole("img", { name: /transcod/i })).toBeInTheDocument();
    render(<AbrPlaybackSequence />);
    expect(screen.getByRole("img", { name: /playback|adaptive|stream/i })).toBeInTheDocument();
    render(<CdnDeliverySequence />);
    expect(screen.getByRole("img", { name: /cdn|delivery|cache/i })).toBeInTheDocument();
  });
});

describe("CollaborativeDocEditorArchitecture", () => {
  it("exposes the collaborative editor architecture to non-visual readers", () => {
    render(<CollaborativeDocEditorArchitecture />);
    expect(
      screen.getByRole("img", { name: /collaborative (document )?editor architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/converge/i)).toBeInTheDocument();
  });
});

describe("collaborative editor flow sequences", () => {
  it("renders the edit, conflict, presence, and reconnect sequences", () => {
    render(<EditBroadcastSequence />);
    expect(screen.getByRole("img", { name: /edit|broadcast/i })).toBeInTheDocument();
    render(<ConflictResolutionSequence />);
    expect(screen.getByRole("img", { name: /conflict|transform|converge/i })).toBeInTheDocument();
    render(<PresenceSequence />);
    expect(screen.getByRole("img", { name: /presence|cursor/i })).toBeInTheDocument();
    render(<ReconnectSyncSequence />);
    expect(screen.getByRole("img", { name: /reconnect|sync|catch/i })).toBeInTheDocument();
  });
});

describe("DistributedCacheArchitecture", () => {
  it("exposes the distributed cache architecture to non-visual readers", () => {
    render(<DistributedCacheArchitecture />);
    expect(
      screen.getByRole("img", { name: /distributed cache architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/consistent hashing/i)).toBeInTheDocument();
  });
});

describe("cache flow sequences", () => {
  it("renders the hit, miss, rebalance, and stampede sequences", () => {
    render(<CacheHitSequence />);
    expect(screen.getByRole("img", { name: /hit/i })).toBeInTheDocument();
    render(<CacheMissSequence />);
    expect(screen.getByRole("img", { name: /miss/i })).toBeInTheDocument();
    render(<NodeRebalanceSequence />);
    expect(screen.getByRole("img", { name: /rebalance|ring|node|hash/i })).toBeInTheDocument();
    render(<StampedeSequence />);
    expect(screen.getByRole("img", { name: /stampede|herd|coalesc/i })).toBeInTheDocument();
  });
});

import { CloudDriveArchitecture } from "@/components/diagrams/cloud-drive-architecture";
import {
  FileUploadSequence,
  DeltaSyncSequence,
  ChangeNotificationSequence,
  ConflictSequence,
} from "@/components/diagrams/cloud-drive-flows";

describe("CloudDriveArchitecture", () => {
  it("exposes the cloud drive architecture to non-visual readers", () => {
    render(<CloudDriveArchitecture />);
    expect(
      screen.getByRole("img", { name: /cloud drive architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/content-addressed/i)).toBeInTheDocument();
  });
});

describe("cloud drive flow sequences", () => {
  it("renders the upload, delta-sync, notification, and conflict sequences", () => {
    render(<FileUploadSequence />);
    expect(screen.getByRole("img", { name: /upload/i })).toBeInTheDocument();
    render(<DeltaSyncSequence />);
    expect(screen.getByRole("img", { name: /delta/i })).toBeInTheDocument();
    render(<ChangeNotificationSequence />);
    expect(screen.getByRole("img", { name: /notif|push|fan/i })).toBeInTheDocument();
    render(<ConflictSequence />);
    expect(screen.getByRole("img", { name: /conflict/i })).toBeInTheDocument();
  });
});

import { PaymentSystemArchitecture } from "@/components/diagrams/payment-system-architecture";
import {
  AuthCaptureSequence,
  IdempotentRetrySequence,
  ReconciliationSequence,
  RefundSequence,
} from "@/components/diagrams/payment-flows";

describe("PaymentSystemArchitecture", () => {
  it("exposes the payment system architecture to non-visual readers", () => {
    render(<PaymentSystemArchitecture />);
    expect(
      screen.getByRole("img", { name: /payment system architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/source of truth/i)).toBeInTheDocument();
  });
});

describe("payment flow sequences", () => {
  it("renders the auth-capture, idempotent-retry, reconciliation, and refund sequences", () => {
    render(<AuthCaptureSequence />);
    expect(screen.getByRole("img", { name: /authoriz/i })).toBeInTheDocument();
    render(<IdempotentRetrySequence />);
    expect(screen.getByRole("img", { name: /idempoten|retry/i })).toBeInTheDocument();
    render(<ReconciliationSequence />);
    expect(screen.getByRole("img", { name: /reconcil/i })).toBeInTheDocument();
    render(<RefundSequence />);
    expect(screen.getByRole("img", { name: /refund/i })).toBeInTheDocument();
  });
});

import { DistributedLoggingArchitecture } from "@/components/diagrams/distributed-logging-architecture";
import {
  LogIngestSequence,
  IndexBuildSequence,
  SearchQuerySequence,
  RetentionTierSequence,
} from "@/components/diagrams/logging-flows";

describe("DistributedLoggingArchitecture", () => {
  it("exposes the distributed logging architecture to non-visual readers", () => {
    render(<DistributedLoggingArchitecture />);
    expect(
      screen.getByRole("img", { name: /distributed logging architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/firehose/i)).toBeInTheDocument();
  });
});

describe("logging flow sequences", () => {
  it("renders the ingest, index-build, search, and retention sequences", () => {
    render(<LogIngestSequence />);
    expect(screen.getByRole("img", { name: /ingest/i })).toBeInTheDocument();
    render(<IndexBuildSequence />);
    expect(screen.getByRole("img", { name: /index/i })).toBeInTheDocument();
    render(<SearchQuerySequence />);
    expect(screen.getByRole("img", { name: /search/i })).toBeInTheDocument();
    render(<RetentionTierSequence />);
    expect(screen.getByRole("img", { name: /retention|tier/i })).toBeInTheDocument();
  });
});

import { DistributedJobSchedulerArchitecture } from "@/components/diagrams/distributed-job-scheduler-architecture";
import {
  ScheduleJobSequence,
  DispatchExecuteSequence,
  LeaseRecoverySequence,
  RetryBackoffSequence as JobRetryBackoffSequence,
} from "@/components/diagrams/job-scheduler-flows";

describe("DistributedJobSchedulerArchitecture", () => {
  it("exposes the job scheduler architecture to non-visual readers", () => {
    render(<DistributedJobSchedulerArchitecture />);
    expect(
      screen.getByRole("img", { name: /job scheduler architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/at-least-once/i)).toBeInTheDocument();
  });
});

describe("job scheduler flow sequences", () => {
  it("renders the schedule, dispatch, lease-recovery, and retry sequences", () => {
    render(<ScheduleJobSequence />);
    expect(screen.getByRole("img", { name: /schedul/i })).toBeInTheDocument();
    render(<DispatchExecuteSequence />);
    expect(screen.getByRole("img", { name: /dispatch/i })).toBeInTheDocument();
    render(<LeaseRecoverySequence />);
    expect(screen.getByRole("img", { name: /recover/i })).toBeInTheDocument();
    render(<JobRetryBackoffSequence />);
    expect(screen.getByRole("img", { name: /retry/i })).toBeInTheDocument();
  });
});

import { MapsNavigationArchitecture } from "@/components/diagrams/maps-navigation-architecture";
import {
  RouteQuerySequence,
  MapMatchSequence,
  TrafficUpdateSequence,
  TileFetchSequence,
} from "@/components/diagrams/maps-navigation-flows";

describe("MapsNavigationArchitecture", () => {
  it("exposes the maps and navigation architecture to non-visual readers", () => {
    render(<MapsNavigationArchitecture />);
    expect(
      screen.getByRole("img", { name: /maps (and )?navigation architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/contraction hierarch/i)).toBeInTheDocument();
  });
});

describe("maps and navigation flow sequences", () => {
  it("renders the route, map-match, traffic, and tile sequences", () => {
    render(<RouteQuerySequence />);
    expect(screen.getByRole("img", { name: /route/i })).toBeInTheDocument();
    render(<MapMatchSequence />);
    expect(screen.getByRole("img", { name: /match/i })).toBeInTheDocument();
    render(<TrafficUpdateSequence />);
    expect(screen.getByRole("img", { name: /traffic/i })).toBeInTheDocument();
    render(<TileFetchSequence />);
    expect(screen.getByRole("img", { name: /tile/i })).toBeInTheDocument();
  });
});

import { ApiGatewayArchitecture } from "@/components/diagrams/api-gateway-architecture";
import {
  ProxyRequestSequence,
  AuthRejectSequence,
  ConfigPushSequence,
  CircuitBreakSequence,
} from "@/components/diagrams/api-gateway-flows";

describe("ApiGatewayArchitecture", () => {
  it("exposes the api gateway architecture to non-visual readers", () => {
    render(<ApiGatewayArchitecture />);
    expect(
      screen.getByRole("img", { name: /api gateway architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/cross-cutting/i)).toBeInTheDocument();
  });
});

describe("api gateway flow sequences", () => {
  it("renders the proxy, auth-reject, config, and circuit sequences", () => {
    render(<ProxyRequestSequence />);
    expect(screen.getByRole("img", { name: /proxy/i })).toBeInTheDocument();
    render(<AuthRejectSequence />);
    expect(screen.getByRole("img", { name: /reject/i })).toBeInTheDocument();
    render(<ConfigPushSequence />);
    expect(screen.getByRole("img", { name: /config/i })).toBeInTheDocument();
    render(<CircuitBreakSequence />);
    expect(screen.getByRole("img", { name: /circuit/i })).toBeInTheDocument();
  });
});

import { WebCrawlerArchitecture } from "@/components/diagrams/web-crawler-architecture";
import {
  FetchPageSequence,
  DedupCheckSequence,
  PolitenessSequence,
  RecrawlSequence,
} from "@/components/diagrams/web-crawler-flows";

describe("WebCrawlerArchitecture", () => {
  it("exposes the web crawler architecture to non-visual readers", () => {
    render(<WebCrawlerArchitecture />);
    expect(
      screen.getByRole("img", { name: /web crawler architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/bloom filter/i)).toBeInTheDocument();
  });
});

describe("web crawler flow sequences", () => {
  it("renders the fetch, dedup, politeness, and recrawl sequences", () => {
    render(<FetchPageSequence />);
    expect(screen.getByRole("img", { name: /fetch/i })).toBeInTheDocument();
    render(<DedupCheckSequence />);
    expect(screen.getByRole("img", { name: /dedup/i })).toBeInTheDocument();
    render(<PolitenessSequence />);
    expect(screen.getByRole("img", { name: /polite/i })).toBeInTheDocument();
    render(<RecrawlSequence />);
    expect(screen.getByRole("img", { name: /recrawl/i })).toBeInTheDocument();
  });
});

import { SearchAutocompleteArchitecture } from "@/components/diagrams/search-autocomplete-architecture";
import {
  AutocompleteQuerySequence,
  IndexBuildSequence as AutocompleteIndexBuildSequence,
  TrendingUpdateSequence,
  TypoCorrectionSequence,
} from "@/components/diagrams/search-autocomplete-flows";

describe("SearchAutocompleteArchitecture", () => {
  it("exposes the search autocomplete architecture to non-visual readers", () => {
    render(<SearchAutocompleteArchitecture />);
    expect(
      screen.getByRole("img", { name: /search autocomplete architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/precomputed top-k/i)).toBeInTheDocument();
  });
});

describe("search autocomplete flow sequences", () => {
  it("renders the query, index-build, trending, and typo sequences", () => {
    render(<AutocompleteQuerySequence />);
    expect(screen.getByRole("img", { name: /query/i })).toBeInTheDocument();
    render(<AutocompleteIndexBuildSequence />);
    expect(screen.getByRole("img", { name: /build/i })).toBeInTheDocument();
    render(<TrendingUpdateSequence />);
    expect(screen.getByRole("img", { name: /trending/i })).toBeInTheDocument();
    render(<TypoCorrectionSequence />);
    expect(screen.getByRole("img", { name: /typo/i })).toBeInTheDocument();
  });
});

import { NewsFeedArchitecture } from "@/components/diagrams/news-feed-architecture";
import {
  PublishFanoutSequence,
  ReadFeedSequence,
  HybridMergeSequence,
  FeedRankingSequence,
} from "@/components/diagrams/news-feed-flows";

describe("NewsFeedArchitecture", () => {
  it("exposes the news feed architecture to non-visual readers", () => {
    render(<NewsFeedArchitecture />);
    expect(
      screen.getByRole("img", { name: /news feed architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/fan-out on write/i)).toBeInTheDocument();
  });
});

describe("news feed flow sequences", () => {
  it("renders the publish, read, hybrid, and ranking sequences", () => {
    render(<PublishFanoutSequence />);
    expect(screen.getByRole("img", { name: /publish/i })).toBeInTheDocument();
    render(<ReadFeedSequence />);
    expect(screen.getByRole("img", { name: /read/i })).toBeInTheDocument();
    render(<HybridMergeSequence />);
    expect(screen.getByRole("img", { name: /hybrid/i })).toBeInTheDocument();
    render(<FeedRankingSequence />);
    expect(screen.getByRole("img", { name: /ranking/i })).toBeInTheDocument();
  });
});

import { ChatArchitecture } from "@/components/diagrams/chat-system-architecture";
import {
  SendMessageSequence,
  OfflineDeliverySequence,
  DeliveryReceiptSequence,
  PresenceUpdateSequence,
} from "@/components/diagrams/chat-system-flows";

describe("ChatArchitecture", () => {
  it("exposes the chat system architecture to non-visual readers", () => {
    render(<ChatArchitecture />);
    expect(
      screen.getByRole("img", { name: /chat system architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/persistent connection/i)).toBeInTheDocument();
  });
});

describe("chat system flow sequences", () => {
  it("renders the send, offline, receipt, and presence sequences", () => {
    render(<SendMessageSequence />);
    expect(screen.getByRole("img", { name: /send/i })).toBeInTheDocument();
    render(<OfflineDeliverySequence />);
    expect(screen.getByRole("img", { name: /offline/i })).toBeInTheDocument();
    render(<DeliveryReceiptSequence />);
    expect(screen.getByRole("img", { name: /receipt/i })).toBeInTheDocument();
    render(<PresenceUpdateSequence />);
    expect(screen.getByRole("img", { name: /presence/i })).toBeInTheDocument();
  });
});

import {
  OAuthAuthCodeSequence,
  SessionVsTokenSequence,
} from "@/components/diagrams/authentication-flows";

describe("Authentication flow diagrams", () => {
  it("exposes the OAuth authorization-code flow to non-visual readers", () => {
    render(<OAuthAuthCodeSequence />);
    expect(
      screen.getByRole("img", { name: /authorization-code flow with pkce/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/without ever revealing their password/i)).toBeInTheDocument();
  });

  it("contrasts stateful session lookup with stateless verification", () => {
    render(<SessionVsTokenSequence />);
    expect(
      screen.getByRole("img", { name: /session lookup vs stateless token/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/network round-trip on the hot path/i)).toBeInTheDocument();
  });
});

import {
  TlsHandshakeSequence,
  CertValidationSequence,
} from "@/components/diagrams/tls-flows";
import {
  AuthorizationDecisionSequence,
  RelationshipCheckSequence,
} from "@/components/diagrams/authorization-flows";
import {
  PasswordRegistrationSequence,
  PasswordVerificationSequence,
} from "@/components/diagrams/password-hashing-flows";
import {
  EnvelopeEncryptSequence,
  EnvelopeDecryptSequence,
} from "@/components/diagrams/encryption-key-management-flows";
import {
  InjectionAttackSequence,
  SsrfAttackSequence,
} from "@/components/diagrams/owasp-top-10-flows";
import {
  BolaAttackSequence,
  GatewayEnforcementSequence,
} from "@/components/diagrams/api-security-flows";
import {
  SessionFixationSequence,
  SecureLoginSessionSequence,
} from "@/components/diagrams/session-management-flows";
import {
  SecureSdlcPipelineSequence,
  VulnerabilityResponseSequence,
} from "@/components/diagrams/secure-sdlc-flows";
import { LeaderboardArchitecture } from "@/components/diagrams/leaderboard-architecture";
import {
  SubmitScoreSequence,
  TopKQuerySequence,
  PlayerRankSequence,
  ShardedRankSequence,
} from "@/components/diagrams/leaderboard-flows";
import { MetricsArchitecture } from "@/components/diagrams/metrics-monitoring-architecture";
import {
  IngestSampleSequence,
  RangeQuerySequence,
  AlertEvaluationSequence,
  DownsampleRetentionSequence,
} from "@/components/diagrams/metrics-monitoring-flows";
import { ObjectStorageArchitecture } from "@/components/diagrams/object-storage-architecture";
import {
  PutObjectSequence,
  MultipartUploadSequence,
  GetObjectSequence,
  ScrubRepairSequence,
} from "@/components/diagrams/object-storage-flows";
import { PhotoSharingArchitecture } from "@/components/diagrams/photo-sharing-architecture";
import {
  UploadPhotoSequence,
  ProcessImageSequence,
  ServeImageSequence,
  FeedLoadSequence,
} from "@/components/diagrams/photo-sharing-flows";
import { RideHailingArchitecture } from "@/components/diagrams/ride-hailing-architecture";
import {
  LocationUpdateSequence,
  MatchRideSequence,
  TripStateSequence,
  LiveTrackingSequence,
} from "@/components/diagrams/ride-hailing-flows";
import { CdnArchitecture } from "@/components/diagrams/content-delivery-network-architecture";
import {
  EdgeRequestRoutingSequence,
  EdgeCacheLookupSequence,
  OriginShieldSequence,
  CacheInvalidationSequence,
} from "@/components/diagrams/content-delivery-network-flows";
import { SnowflakeArchitecture } from "@/components/diagrams/unique-id-generator-architecture";
import {
  GenerateIdSequence,
  WorkerIdAssignmentSequence,
  ClockSkewSequence,
  SequenceOverflowSequence,
} from "@/components/diagrams/unique-id-generator-flows";

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

describe("Authorization flow diagrams", () => {
  it("exposes the authorization decision to non-visual readers", () => {
    render(<AuthorizationDecisionSequence />);
    expect(
      screen.getByRole("img", { name: /an externalized authorization decision/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/decoupling deciding from enforcing/i)).toBeInTheDocument();
  });

  it("exposes the relationship-based permission check to non-visual readers", () => {
    render(<RelationshipCheckSequence />);
    expect(
      screen.getByRole("img", { name: /a relationship-based permission check/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Google Zanzibar popularized/i)).toBeInTheDocument();
  });
});

describe("Password hashing flow diagrams", () => {
  it("exposes password registration hashing to non-visual readers", () => {
    render(<PasswordRegistrationSequence />);
    expect(
      screen.getByRole("img", { name: /hashing a password at registration/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/a stolen database reveals no usable passwords/i)).toBeInTheDocument();
  });

  it("exposes password verification to non-visual readers", () => {
    render(<PasswordVerificationSequence />);
    expect(
      screen.getByRole("img", { name: /verifying a password at login/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/recomputed and compared in constant time/i)).toBeInTheDocument();
  });
});

describe("Envelope encryption flow diagrams", () => {
  it("exposes envelope encryption to non-visual readers", () => {
    render(<EnvelopeEncryptSequence />);
    expect(
      screen.getByRole("img", { name: /encrypting data with envelope encryption/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/the master key never leaves the KMS/i)).toBeInTheDocument();
  });

  it("exposes envelope decryption to non-visual readers", () => {
    render(<EnvelopeDecryptSequence />);
    expect(
      screen.getByRole("img", { name: /decrypting data with envelope encryption/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/consulted per data key, not per object/i)).toBeInTheDocument();
  });
});

describe("OWASP attack flow diagrams", () => {
  it("exposes the SQL injection attack to non-visual readers", () => {
    render(<InjectionAttackSequence />);
    expect(
      screen.getByRole("img", { name: /a SQL injection attack/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/sends the query and the values on separate channels/i)).toBeInTheDocument();
  });

  it("exposes the SSRF attack to non-visual readers", () => {
    render(<SsrfAttackSequence />);
    expect(
      screen.getByRole("img", { name: /a server-side request forgery attack/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/allow only an explicit list of permitted destinations/i)).toBeInTheDocument();
  });
});

describe("API security flow diagrams", () => {
  it("exposes the BOLA attack to non-visual readers", () => {
    render(<BolaAttackSequence />);
    expect(
      screen.getByRole("img", { name: /a broken object-level authorization \(BOLA\) attack/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/a per-object ownership check on every request/i)).toBeInTheDocument();
  });

  it("exposes layered gateway enforcement to non-visual readers", () => {
    render(<GatewayEnforcementSequence />);
    expect(
      screen.getByRole("img", { name: /layered enforcement at the API gateway/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Coarse checks at the edge, ownership checks in the service/i)).toBeInTheDocument();
  });
});

describe("Session management flow diagrams", () => {
  it("exposes the session fixation attack to non-visual readers", () => {
    render(<SessionFixationSequence />);
    expect(
      screen.getByRole("img", { name: /a session fixation attack/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/regenerate the session id at login/i)).toBeInTheDocument();
  });

  it("exposes secure session establishment to non-visual readers", () => {
    render(<SecureLoginSessionSequence />);
    expect(
      screen.getByRole("img", { name: /establishing and validating a secure session/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/it is simply a bearer credential validated server-side every time/i)).toBeInTheDocument();
  });
});

describe("Secure SDLC flow diagrams", () => {
  it("exposes the CI/CD security gates to non-visual readers", () => {
    render(<SecureSdlcPipelineSequence />);
    expect(
      screen.getByRole("img", { name: /security gates in the CI\/CD pipeline/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/shift-left, automated and enforced on every change/i)).toBeInTheDocument();
  });

  it("exposes the vulnerability-management loop to non-visual readers", () => {
    render(<VulnerabilityResponseSequence />);
    expect(
      screen.getByRole("img", { name: /the vulnerability-management loop/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/turns scattered findings into reliably closed risks/i)).toBeInTheDocument();
  });
});

describe("Leaderboard diagrams", () => {
  it("exposes the leaderboard architecture to non-visual readers", () => {
    render(<LeaderboardArchitecture />);
    expect(
      screen.getByRole("img", { name: /leaderboard architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/rebuilt from the database, so no scores are lost/i)).toBeInTheDocument();
  });

  it("exposes the score-submit flow to non-visual readers", () => {
    render(<SubmitScoreSequence />);
    expect(
      screen.getByRole("img", { name: /submit a score update/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/keeps updates cheap at high volume/i)).toBeInTheDocument();
  });

  it("exposes the top-K read flow to non-visual readers", () => {
    render(<TopKQuerySequence />);
    expect(
      screen.getByRole("img", { name: /read the top-K leaderboard/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Because everyone sees the same top-K/i)).toBeInTheDocument();
  });

  it("exposes the player-rank flow to non-visual readers", () => {
    render(<PlayerRankSequence />);
    expect(
      screen.getByRole("img", { name: /look up a player's rank and neighbors/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/a plain ORDER BY cannot provide cheaply/i)).toBeInTheDocument();
  });

  it("exposes the cross-shard rank flow to non-visual readers", () => {
    render(<ShardedRankSequence />);
    expect(
      screen.getByRole("img", { name: /compute a global rank across shards/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/approximate the rank from precomputed score-bucket histograms/i)).toBeInTheDocument();
  });
});

describe("Metrics and monitoring diagrams", () => {
  it("exposes the metrics architecture to non-visual readers", () => {
    render(<MetricsArchitecture />);
    expect(
      screen.getByRole("img", { name: /metrics and monitoring architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/shaped by a relentless write firehose in and cheap, recent-range reads out/i)).toBeInTheDocument();
  });

  it("exposes the ingest flow to non-visual readers", () => {
    render(<IngestSampleSequence />);
    expect(
      screen.getByRole("img", { name: /ingest a batch of samples/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/never blocking the producers that emit them/i)).toBeInTheDocument();
  });

  it("exposes the range-query flow to non-visual readers", () => {
    render(<RangeQuerySequence />);
    expect(
      screen.getByRole("img", { name: /serve a range query/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/reads touch only recent, contiguous blocks/i)).toBeInTheDocument();
  });

  it("exposes the alert-evaluation flow to non-visual readers", () => {
    render(<AlertEvaluationSequence />);
    expect(
      screen.getByRole("img", { name: /evaluate an alert rule and fire/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/the for-duration requirement suppresses flapping/i)).toBeInTheDocument();
  });

  it("exposes the downsample/retention flow to non-visual readers", () => {
    render(<DownsampleRetentionSequence />);
    expect(
      screen.getByRole("img", { name: /downsample and expire old data/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/bounds long-term storage without losing the shape of history/i)).toBeInTheDocument();
  });
});

describe("Object storage diagrams", () => {
  it("exposes the object storage architecture to non-visual readers", () => {
    render(<ObjectStorageArchitecture />);
    expect(
      screen.getByRole("img", { name: /object storage architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Durability comes from spreading erasure-coded fragments across independent failure domains/i)).toBeInTheDocument();
  });

  it("exposes the put-object flow to non-visual readers", () => {
    render(<PutObjectSequence />);
    expect(
      screen.getByRole("img", { name: /write \(PUT\) an object/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/the metadata is committed last, so a half-written object is never visible/i)).toBeInTheDocument();
  });

  it("exposes the multipart-upload flow to non-visual readers", () => {
    render(<MultipartUploadSequence />);
    expect(
      screen.getByRole("img", { name: /multipart upload of a large object/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Each part uploads and retries independently/i)).toBeInTheDocument();
  });

  it("exposes the get-object flow to non-visual readers", () => {
    render(<GetObjectSequence />);
    expect(
      screen.getByRole("img", { name: /read \(GET\) an object/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Any k of the total fragments are enough to reconstruct the object/i)).toBeInTheDocument();
  });

  it("exposes the scrub/repair flow to non-visual readers", () => {
    render(<ScrubRepairSequence />);
    expect(
      screen.getByRole("img", { name: /scrub and repair a corrupt fragment/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/continuous background repair is what sustains durability over years/i)).toBeInTheDocument();
  });
});

describe("Photo sharing diagrams", () => {
  it("exposes the photo sharing architecture to non-visual readers", () => {
    render(<PhotoSharingArchitecture />);
    expect(
      screen.getByRole("img", { name: /photo sharing architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/a write-amplified async media pipeline feeding a read-dominated, CDN-served delivery path/i)).toBeInTheDocument();
  });

  it("exposes the upload flow to non-visual readers", () => {
    render(<UploadPhotoSequence />);
    expect(
      screen.getByRole("img", { name: /upload a photo/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/uploading directly to the object store bypasses the application servers/i)).toBeInTheDocument();
  });

  it("exposes the image-processing flow to non-visual readers", () => {
    render(<ProcessImageSequence />);
    expect(
      screen.getByRole("img", { name: /process an uploaded image/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/The original is never modified, so derivatives can be regenerated/i)).toBeInTheDocument();
  });

  it("exposes the serve-image flow to non-visual readers", () => {
    render(<ServeImageSequence />);
    expect(
      screen.getByRole("img", { name: /serve an image/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/the CDN absorbs the overwhelming majority of read traffic/i)).toBeInTheDocument();
  });

  it("exposes the feed-load flow to non-visual readers", () => {
    render(<FeedLoadSequence />);
    expect(
      screen.getByRole("img", { name: /load a photo feed/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/The feed is a list of post IDs hydrated with image URLs/i)).toBeInTheDocument();
  });
});

describe("Ride-hailing diagrams", () => {
  it("exposes the ride-hailing architecture to non-visual readers", () => {
    render(<RideHailingArchitecture />);
    expect(
      screen.getByRole("img", { name: /ride-hailing architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/absorbs a huge location-update firehose into a live geo-index/i)).toBeInTheDocument();
  });

  it("exposes the location-update flow to non-visual readers", () => {
    render(<LocationUpdateSequence />);
    expect(
      screen.getByRole("img", { name: /a driver location update/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Only the latest position is kept, not a durable history of every ping/i)).toBeInTheDocument();
  });

  it("exposes the match flow to non-visual readers", () => {
    render(<MatchRideSequence />);
    expect(
      screen.getByRole("img", { name: /match a rider to a driver/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/An atomic reservation ensures one driver is never matched to two riders/i)).toBeInTheDocument();
  });

  it("exposes the trip-lifecycle flow to non-visual readers", () => {
    render(<TripStateSequence />);
    expect(
      screen.getByRole("img", { name: /the trip lifecycle/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/every trip is an explicit state machine that rejects invalid transitions/i)).toBeInTheDocument();
  });

  it("exposes the live-tracking flow to non-visual readers", () => {
    render(<LiveTrackingSequence />);
    expect(
      screen.getByRole("img", { name: /track the driver in real time/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/the rider subscribes to the assigned driver's live location stream/i)).toBeInTheDocument();
  });
});

describe("Content delivery network diagrams", () => {
  it("exposes the CDN architecture to non-visual readers", () => {
    render(<CdnArchitecture />);
    expect(
      screen.getByRole("img", { name: /content delivery network architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/the cache-hit ratio is what determines how thin that sliver is/i)).toBeInTheDocument();
  });

  it("exposes the edge request-routing flow to non-visual readers", () => {
    render(<EdgeRequestRoutingSequence />);
    expect(
      screen.getByRole("img", { name: /route a request to the nearest edge/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/routing around a failed PoP without the user ever noticing/i)).toBeInTheDocument();
  });

  it("exposes the edge cache-lookup flow to non-visual readers", () => {
    render(<EdgeCacheLookupSequence />);
    expect(
      screen.getByRole("img", { name: /look up an object at the edge cache/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/the hit ratio, not raw capacity, is what actually offloads the origin/i)).toBeInTheDocument();
  });

  it("exposes the origin-shield flow to non-visual readers", () => {
    render(<OriginShieldSequence />);
    expect(
      screen.getByRole("img", { name: /an origin shield absorbs concurrent edge misses/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/collapses a thundering herd of concurrent misses into one origin fetch/i)).toBeInTheDocument();
  });

  it("exposes the cache-invalidation flow to non-visual readers", () => {
    render(<CacheInvalidationSequence />);
    expect(
      screen.getByRole("img", { name: /invalidate stale content across the edge/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/versioned, immutable URLs avoid invalidation entirely/i)).toBeInTheDocument();
  });
});

describe("Unique ID generator diagrams", () => {
  it("exposes the Snowflake architecture to non-visual readers", () => {
    render(<SnowflakeArchitecture />);
    expect(
      screen.getByRole("img", { name: /unique id generator architecture/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/zero shared state between nodes/i)).toBeInTheDocument();
  });

  it("exposes the generate-id flow to non-visual readers", () => {
    render(<GenerateIdSequence />);
    expect(
      screen.getByRole("img", { name: /generate an id/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no coordination with any other node is needed on this path/i)).toBeInTheDocument();
  });

  it("exposes the worker-id assignment flow to non-visual readers", () => {
    render(<WorkerIdAssignmentSequence />);
    expect(
      screen.getByRole("img", { name: /assign a worker\/machine id at startup/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no two nodes ever share the machine-id bits/i)).toBeInTheDocument();
  });

  it("exposes the clock-skew flow to non-visual readers", () => {
    render(<ClockSkewSequence />);
    expect(
      screen.getByRole("img", { name: /handle clock skew during id generation/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/an NTP correction pushes the wall clock backwards/i)).toBeInTheDocument();
  });

  it("exposes the sequence-overflow flow to non-visual readers", () => {
    render(<SequenceOverflowSequence />);
    expect(
      screen.getByRole("img", { name: /handle per-millisecond sequence overflow/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/caps per-node throughput but keeps every id it produces unique/i)).toBeInTheDocument();
  });
});
