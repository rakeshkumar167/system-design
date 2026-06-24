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
