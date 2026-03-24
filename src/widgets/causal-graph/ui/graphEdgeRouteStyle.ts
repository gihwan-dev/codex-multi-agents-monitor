import type { CSSProperties } from "react";

import type { GraphSceneEdgeBundle } from "../../../entities/run";
import { EDGE_COLORS } from "./graphCanvasStyles";

export function buildEdgeRouteStyle(bundle: GraphSceneEdgeBundle): CSSProperties {
  return {
    color: EDGE_COLORS[bundle.edgeType] ?? "var(--color-graph-edge-neutral)",
    opacity: bundle.inPath || bundle.selected ? 1 : 0.88,
  };
}

export function resolveEdgeStrokeWidth(bundle: GraphSceneEdgeBundle) {
  return bundle.inPath || bundle.selected ? 3.5 : 2.5;
}

export function resolveEdgeDashArray(edgeType: GraphSceneEdgeBundle["edgeType"]) {
  switch (edgeType) {
    case "handoff":
      return "6 4";
    case "transfer":
      return "2 4";
    case "merge":
      return "1 3";
    default:
      return undefined;
  }
}
