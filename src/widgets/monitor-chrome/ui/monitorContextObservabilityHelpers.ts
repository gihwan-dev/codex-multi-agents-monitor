import type { LaneContextSummary } from "../../../entities/run";
import { formatTokens } from "../../../shared/lib/format";

export function formatShare(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatTokenMetric(value: number) {
  return value > 0 ? formatTokens(value) : "0";
}

export function buildLaneSummaryToggleCopy(
  lanes: LaneContextSummary[],
  open: boolean,
) {
  if (lanes.length === 0) {
    return open ? "No active lanes" : "No lane summaries";
  }

  const selectedLane = lanes.find((lane) => lane.isSelected);
  if (selectedLane) {
    return open
      ? `${selectedLane.laneName} selected`
      : `${selectedLane.laneName} highlighted`;
  }

  return open ? `${lanes.length} lanes expanded` : `${lanes.length} lanes`;
}
