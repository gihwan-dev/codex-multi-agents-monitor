import type { TimelineConnectorKind, TimelineItemKind, TimelineSelection } from "../types";

export type TimelineTrackKind = "user" | "main" | "branch";
export type TimelineRowKind = "turn-header" | "event" | "gap";
export type TimelineEdgeTaxonomy = "branch" | "flow" | "tool";
export type TimelineEdgeKind = TimelineConnectorKind | "tool";

export interface TimelineTrackOccupancy {
  actorLabel: string;
  endedAtMs: number | null;
  endedRowId: string | null;
  sessionId: string;
  startedAtMs: number;
  startedRowId: string;
}

export interface TimelineTrackView {
  kind: TimelineTrackKind;
  label: string;
  occupancies: TimelineTrackOccupancy[];
  slotIndex: number;
  trackId: string;
}

export interface TimelineRowAnnotationView {
  directionLabel: string | null;
  latencyMs: number | null;
  payloadSize: number | null;
  summary: string | null;
  timeLabel: string;
  tokenTotal: number;
  toolLabel: string | null;
}

interface TimelineBaseRowView {
  endedAtMs: number | null;
  kind: TimelineRowKind;
  rowId: string;
  rowIndex: number;
  startedAtMs: number;
  trackId: string | null;
}

export interface TimelineTurnHeaderRowView extends TimelineBaseRowView {
  kind: "turn-header";
  label: string;
  selection: TimelineSelection;
  summary: string | null;
  turnBandId: string;
  userItemId: string | null;
}

export interface TimelineEventRowView extends TimelineBaseRowView {
  actorLabel: string;
  annotation: TimelineRowAnnotationView;
  connectorIds: string[];
  itemId: string;
  itemKind: TimelineItemKind;
  kind: "event";
  ownerSessionId: string;
  requestPreview: string | null;
  responsePreview: string | null;
  segmentId: string | null;
  selection: TimelineSelection;
  summary: string | null;
  turnBandId: string | null;
}

export interface TimelineGapRowView extends TimelineBaseRowView {
  hiddenDurationMs: number;
  kind: "gap";
  label: string;
  selection: null;
  sourceRowId: string;
  targetRowId: string;
}

export type TimelineRowView =
  | TimelineTurnHeaderRowView
  | TimelineEventRowView
  | TimelineGapRowView;

export interface TimelineEdgeAnchorRow {
  kind: "row";
  rowId: string;
  trackId: string;
}

export interface TimelineEdgeAnchorAnnotation {
  kind: "annotation";
  rowId: string;
  trackId: null;
}

export type TimelineEdgeAnchor = TimelineEdgeAnchorRow | TimelineEdgeAnchorAnnotation;

export interface TimelineEdgeView {
  connectorId: string | null;
  directionLabel: string | null;
  edgeId: string;
  kind: TimelineEdgeKind;
  requestPreview: string | null;
  responsePreview: string | null;
  selection: TimelineSelection | null;
  source: TimelineEdgeAnchor;
  target: TimelineEdgeAnchor;
  taxonomy: TimelineEdgeTaxonomy;
}

export interface TimelineLiveDagView {
  edges: TimelineEdgeView[];
  edgesById: Record<string, TimelineEdgeView>;
  gapThresholdMs: number;
  rowIdsByItemId: Record<string, string>;
  rows: TimelineRowView[];
  rowsById: Record<string, TimelineRowView>;
  trackIdBySessionId: Record<string, string>;
  tracks: TimelineTrackView[];
}
