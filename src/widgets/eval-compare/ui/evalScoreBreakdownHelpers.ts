import type {
  ScorecardAxis,
  ScorecardAxisDelta,
  ScorecardAxisSummary,
} from "../../../entities/eval";

export const AXIS_LABELS: Record<ScorecardAxis, string> = {
  outcome: "Outcome",
  trust: "Trust",
  efficiency: "Efficiency",
  process: "Process",
};

export function buildAxisScoreLookup(scores: ScorecardAxisSummary[]) {
  return new Map(scores.map((summary) => [summary.axis, summary]));
}

export function buildAxisDeltaLookup(deltas: ScorecardAxisDelta[]) {
  return new Map(deltas.map((summary) => [summary.axis, summary.delta]));
}

export function scoreLabel(value: number | null) {
  return value === null ? "Unscored" : `${value}/100`;
}

export function deltaLabel(value: number | null) {
  if (value === null) {
    return "pending";
  }
  if (value === 0) {
    return "no change";
  }
  return value > 0 ? `+${value}` : `${value}`;
}

export function deltaBadgeVariant(value: number | null) {
  return value !== null && value > 0 ? "default" : "outline";
}

export function summaryScore(summary?: ScorecardAxisSummary) {
  return summary?.score ?? null;
}
