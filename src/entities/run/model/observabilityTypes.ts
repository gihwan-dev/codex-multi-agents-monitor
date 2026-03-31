export type LaneObservabilityKind = "main" | "subagent" | "reviewer" | "unknown";
export type ContextObservabilityFocusSource = "selection" | "viewport" | "latest";

export interface ContextTimelinePoint {
  eventId: string;
  eventTitle: string;
  laneId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cumulativeContextTokens: number;
  contextWindowTokens: number;
  hasMeasuredContextState: boolean;
  hasMeasuredRuntimeUsage: boolean;
  hasCompaction: boolean;
}

export interface LaneContextSummary {
  laneId: string;
  laneName: string;
  laneRole: string;
  laneKind: LaneObservabilityKind;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextImportedTokens: number;
  contextReturnedTokens: number;
  compactionCount: number;
  shareOfTotalContext: number;
  estimatedMainContextSaved: number;
  isSelected: boolean;
}

export interface ContextObservabilityModel {
  activeEventId: string | null;
  activeEventTitle: string | null;
  activeLaneId: string | null;
  activeSource: ContextObservabilityFocusSource;
  activeContextWindowTokens: number;
  activeCumulativeContextTokens: number;
  peakContextWindowTokens: number;
  peakCumulativeContextTokens: number;
  maxContextWindowTokens: number | null;
  laneSummaries: LaneContextSummary[];
  timelinePoints: ContextTimelinePoint[];
  pointsByEventId: Map<string, ContextTimelinePoint>;
}
