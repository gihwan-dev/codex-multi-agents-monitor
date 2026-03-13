import type { CanonicalEvent, CanonicalMetric, CanonicalSession } from "@/shared/canonical";
import type { SessionDetailSnapshot } from "@/shared/queries";

export type TimelineMode = "live" | "archive";

export type TimelineSelection =
  | { kind: "session" }
  | { itemId: string; kind: "item" };

export type TimelineLaneColumn = "user" | "main" | "other";

export type TimelineItemKind =
  | "status"
  | "message"
  | "reasoning"
  | "tool"
  | "token"
  | "error";

export interface TimelineLaneView {
  accentClass: string;
  column: TimelineLaneColumn;
  label: string;
  laneId: string;
}

export interface TimelineItemView {
  detailLevel: CanonicalEvent["detail_level"];
  endedAt: string | null;
  endedAtMs: number | null;
  inputPreview: string | null;
  itemId: string;
  kind: TimelineItemKind;
  label: string;
  laneId: string;
  meta: Record<string, unknown>;
  outputPreview: string | null;
  payloadPreview: string | null;
  sourceEvents: CanonicalEvent[];
  startedAt: string;
  startedAtMs: number;
  summary: string | null;
  tokenInput: number;
  tokenOutput: number;
}

export interface TimelineProjection {
  detail: SessionDetailSnapshot;
  items: TimelineItemView[];
  itemsById: Record<string, TimelineItemView>;
  lanes: TimelineLaneView[];
  latestItemId: string | null;
  metrics: CanonicalMetric[];
  session: CanonicalSession;
  sessionTokenTotals: {
    input: number;
    output: number;
  };
  startedAtMs: number;
  timeRangeMs: number;
}

export interface TimelineViewportState {
  followLatest: boolean;
  mode: TimelineMode;
  pixelsPerMs: number;
  scrollTop: number;
}

