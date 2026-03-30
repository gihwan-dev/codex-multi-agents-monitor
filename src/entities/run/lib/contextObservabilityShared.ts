import type {
  AgentLane,
  EventRecord,
  LaneContextSummary,
  LaneObservabilityKind,
} from "../model/types.js";

export interface LaneSummaryCandidate {
  lane: AgentLane;
  compactionCount: number;
  contextImportedTokens: number;
  contextReturnedTokens: number;
  totalTokens: number;
}

export const CROSS_LANE_RETURN_EDGE_TYPES = new Set(["handoff", "merge", "transfer"]);

export function resolveMeasuredContextWindowTokens(event: EventRecord) {
  return event.measuredContextWindowTokens ?? null;
}

export function resolveMeasuredCumulativeTokens(event: EventRecord) {
  return event.measuredCumulativeTokens ?? null;
}

export function resolveTotalTokens(event: EventRecord) {
  return event.tokensIn + event.tokensOut;
}

export function isCompactionEvent(event: EventRecord) {
  return (
    event.title === "Context compacted" ||
    event.outputPreview?.toLowerCase().includes("compacted") ||
    false
  );
}

export function resolveFallbackReturnedTokens(events: EventRecord[]) {
  return [...events].reverse().find((event) => event.tokensOut > 0)?.tokensOut ?? 0;
}

export function shouldIncludeLaneSummary(lane: LaneSummaryCandidate) {
  return (
    lane.totalTokens > 0 ||
    lane.contextImportedTokens > 0 ||
    lane.contextReturnedTokens > 0 ||
    lane.compactionCount > 0 ||
    lane.lane.role === "session"
  );
}

export function classifyLaneKind(lane: AgentLane): LaneObservabilityKind {
  if (lane.role === "session") {
    return "main";
  }

  const normalizedRole = lane.role.toLowerCase();
  if (normalizedRole.includes("review") || normalizedRole.includes("critic")) {
    return "reviewer";
  }

  if (lane.badge === "Subagent") {
    return "subagent";
  }

  return "unknown";
}

export function compareLaneSummaries(
  left: Omit<LaneContextSummary, "isSelected">,
  right: Omit<LaneContextSummary, "isSelected">,
) {
  const leftPriority = resolveLanePriority(left.laneKind);
  const rightPriority = resolveLanePriority(right.laneKind);

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  if (right.totalTokens !== left.totalTokens) {
    return right.totalTokens - left.totalTokens;
  }

  return left.laneName.localeCompare(right.laneName);
}

function resolveLanePriority(kind: LaneObservabilityKind) {
  if (kind === "main") {
    return 0;
  }

  if (kind === "reviewer") {
    return 1;
  }

  if (kind === "subagent") {
    return 2;
  }

  return 3;
}
