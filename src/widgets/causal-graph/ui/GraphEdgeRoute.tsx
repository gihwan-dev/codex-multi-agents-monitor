import type { CSSProperties } from "react";
import type { GraphSceneEdgeBundle } from "../../../entities/run";
import type { EdgeRouteLayout } from "../model/graphLayout";
import { EDGE_COLORS } from "./graphCanvasStyles";

interface GraphEdgeRouteProps {
  bundle: GraphSceneEdgeBundle | undefined;
  route: EdgeRouteLayout;
  routeMarkerId: string;
}

export function GraphEdgeRoute({
  bundle,
  route,
  routeMarkerId,
}: GraphEdgeRouteProps) {
  if (!bundle) {
    return null;
  }

  return (
    <g
      key={bundle.id}
      data-slot="graph-route"
      data-edge-type={bundle.edgeType}
      data-selected={bundle.selected ? "true" : "false"}
      data-in-path={bundle.inPath ? "true" : "false"}
      style={buildEdgeRouteStyle(bundle)}
    >
      <path
        d={route.path}
        markerEnd={`url(#${routeMarkerId})`}
        fill="none"
        stroke="currentColor"
        strokeWidth={resolveEdgeStrokeWidth(bundle)}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={resolveEdgeDashArray(bundle.edgeType)}
      />
      <GraphEdgePort cx={route.sourcePort.x} cy={route.sourcePort.y} port="source" />
      <GraphEdgePort cx={route.targetPort.x} cy={route.targetPort.y} port="target" />
    </g>
  );
}

function GraphEdgePort({
  cx,
  cy,
  port,
}: {
  cx: number;
  cy: number;
  port: "source" | "target";
}) {
  return (
    <circle
      data-slot="graph-route-port"
      data-port={port}
      cx={cx}
      cy={cy}
      r={4}
      fill="currentColor"
      stroke="var(--color-graph-port-outline)"
      strokeWidth={1.5}
    />
  );
}

function buildEdgeRouteStyle(bundle: GraphSceneEdgeBundle): CSSProperties {
  return {
    color: EDGE_COLORS[bundle.edgeType] ?? "var(--color-graph-edge-neutral)",
    opacity: bundle.inPath || bundle.selected ? 1 : 0.88,
  };
}

function resolveEdgeStrokeWidth(bundle: GraphSceneEdgeBundle) {
  return bundle.inPath || bundle.selected ? 3.5 : 2.5;
}

function resolveEdgeDashArray(edgeType: GraphSceneEdgeBundle["edgeType"]) {
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
