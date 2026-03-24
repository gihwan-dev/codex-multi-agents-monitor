import type { CSSProperties } from "react";

import {
  EVENT_ROW_HEIGHT,
  GAP_ROW_HEIGHT,
  ROW_GAP,
  TIME_GUTTER,
} from "../model/graphLayout";
import type { useCausalGraphViewModel } from "./useCausalGraphViewModel";

export function buildGraphViewportStyle(
  laneMetrics: ReturnType<typeof useCausalGraphViewModel>["graphSnapshot"]["layout"]["laneMetrics"],
): CSSProperties {
  return {
    ["--graph-time-gutter" as string]: `${TIME_GUTTER}px`,
    ["--graph-lane-width" as string]: `${laneMetrics.laneWidth}px`,
    ["--graph-card-width" as string]: `${laneMetrics.cardWidth}px`,
    ["--graph-event-row-height" as string]: `${EVENT_ROW_HEIGHT}px`,
    ["--graph-gap-row-height" as string]: `${GAP_ROW_HEIGHT}px`,
    ["--graph-row-gap" as string]: `${ROW_GAP}px`,
  };
}
