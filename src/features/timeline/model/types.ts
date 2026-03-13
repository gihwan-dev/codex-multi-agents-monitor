import type { CanonicalEvent, CanonicalMetric, CanonicalSession } from "@/shared/canonical";
import type { SessionDetailSnapshot, TimelineLineageRelation } from "@/shared/queries";

export type TimelineMode = "live" | "archive";
export type TimelineRenderMode = "live-compact" | "archive-absolute";

export type TimelineSelection =
  | { kind: "session" }
  | { itemId: string; kind: "item" }
  | { anchorItemId: string; kind: "segment"; segmentId: string }
  | { anchorItemId: string; connectorId: string; kind: "connector" };

export type TimelineLaneColumn = "user" | "main" | "other";
export type TimelineConnectorKind = "spawn" | "handoff" | "reply" | "complete";

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
  ownerSessionId: string | null;
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
  ownerSessionId: string;
  outputPreview: string | null;
  payloadPreview: string | null;
  sourceEvents: CanonicalEvent[];
  startedAt: string;
  startedAtMs: number;
  summary: string | null;
  tokenInput: number;
  tokenOutput: number;
}

export interface TimelineTurnBand {
  endedAtMs: number;
  itemIds: string[];
  label: string;
  startedAtMs: number;
  summary: string | null;
  turnBandId: string;
  turnIndex: number;
  userItemId: string | null;
}

export interface TimelineTurnHeaderRow {
  headerId: string;
  height: number;
  startedAtMs: number;
  summary: string | null;
  top: number;
  turnBandId: string;
  userItemId: string | null;
}

export interface TimelineGapFold {
  gapId: string;
  height: number;
  hiddenDurationMs: number;
  label: string;
  sourceSegmentId: string;
  targetSegmentId: string;
  top: number;
}

export interface TimelineActivationSegment {
  anchorItemId: string;
  endedAtMs: number;
  itemIds: string[];
  laneId: string;
  ownerSessionId: string;
  segmentId: string;
  startedAtMs: number;
  terminalEventKind: CanonicalEvent["kind"];
  terminalItemId: string;
  turnBandId: string;
}

export interface TimelineConnector {
  anchorItemId: string;
  connectorId: string;
  endedAtMs: number;
  kind: TimelineConnectorKind;
  sourceLaneId: string;
  sourceSegmentId: string;
  startedAtMs: number;
  targetAnchorItemId: string;
  targetLaneId: string;
  targetSegmentId: string;
  turnBandId: string;
}

export interface TimelineRelationMap {
  connectors: Record<
    string,
    {
      itemIds: string[];
      segmentIds: [string, string];
      turnBandId: string;
    }
  >;
  items: Record<
    string,
    {
      connectorIds: string[];
      segmentId: string | null;
      turnBandId: string | null;
    }
  >;
  segments: Record<
    string,
    {
      connectorIds: string[];
      itemIds: string[];
      turnBandId: string;
    }
  >;
  turns: Record<
    string,
    {
      connectorIds: string[];
      itemIds: string[];
      segmentIds: string[];
    }
  >;
}

export interface TimelineProjection {
  activationSegments: TimelineActivationSegment[];
  connectors: TimelineConnector[];
  detail: SessionDetailSnapshot;
  connectorsById: Record<string, TimelineConnector>;
  items: TimelineItemView[];
  itemsById: Record<string, TimelineItemView>;
  lanes: TimelineLaneView[];
  lineageRelations: TimelineLineageRelation[];
  latestItemId: string | null;
  metrics: CanonicalMetric[];
  relationMap: TimelineRelationMap;
  rootSessionId: string;
  session: CanonicalSession;
  sessions: CanonicalSession[];
  sessionsById: Record<string, CanonicalSession>;
  sessionTokenTotals: {
    input: number;
    output: number;
  };
  segmentsById: Record<string, TimelineActivationSegment>;
  startedAtMs: number;
  timeRangeMs: number;
  turnBands: TimelineTurnBand[];
  turnBandsById: Record<string, TimelineTurnBand>;
}

export interface TimelineLiveLayout {
  contentHeight: number;
  gapFolds: TimelineGapFold[];
  itemYById: Record<string, number>;
  renderItemIdsBySegmentId: Record<string, string[]>;
  renderMode: "live-compact";
  segmentBoundsById: Record<
    string,
    {
      bottom: number;
      height: number;
      top: number;
    }
  >;
  segmentEntryYById: Record<string, number>;
  segmentExitYById: Record<string, number>;
  turnBoundsById: Record<
    string,
    {
      bottom: number;
      height: number;
      top: number;
    }
  >;
  turnHeaders: TimelineTurnHeaderRow[];
}

export interface TimelineViewportState {
  followLatest: boolean;
  mode: TimelineMode;
  pixelsPerMs: number;
  renderMode: TimelineRenderMode;
  scrollTop: number;
}

export interface TimelineSelectionContext {
  anchorItemId: string | null;
  relatedConnectorIds: string[];
  relatedItemIds: string[];
  relatedSegmentIds: string[];
  selectedConnector: TimelineConnector | null;
  selectedItem: TimelineItemView | null;
  selectedSegment: TimelineActivationSegment | null;
  selectedTurnBand: TimelineTurnBand | null;
}
