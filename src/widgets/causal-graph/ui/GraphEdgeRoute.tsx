import type { GraphSceneEdgeBundle } from "../../../entities/run";
import type { EdgeRouteLayout } from "../model/graphLayout";
import { GraphEdgePort } from "./GraphEdgePort";
import {
  buildEdgeRouteStyle,
  resolveEdgeDashArray,
  resolveEdgeStrokeWidth,
} from "./graphEdgeRouteStyle";

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
