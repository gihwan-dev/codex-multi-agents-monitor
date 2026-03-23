import type { GraphSceneEdgeBundle, GraphSceneModel } from "../../../entities/run";
import { resolveGraphEdgeColor } from "../lib/graphPresentation";
import { type EdgeRouteLayout, type GraphLayoutSnapshot, TIME_GUTTER } from "../model/graphLayout";

interface CausalGraphBackdropSvgProps {
  availableCanvasHeight: number;
  bundleById: Map<string, GraphSceneEdgeBundle>;
  continuationGuideYs: number[];
  layout: GraphLayoutSnapshot;
  renderedContentHeight: number;
  routeMarkerId: string;
  scene: GraphSceneModel;
  scrollTop: number;
  visibleEdgeRoutes: EdgeRouteLayout[];
  visibleRows: GraphSceneModel["rows"];
}

export function CausalGraphBackdropSvg({
  availableCanvasHeight,
  bundleById,
  continuationGuideYs,
  layout,
  renderedContentHeight,
  routeMarkerId,
  scene,
  scrollTop,
  visibleEdgeRoutes,
  visibleRows,
}: CausalGraphBackdropSvgProps) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
      viewBox={`0 0 ${layout.contentWidth} ${renderedContentHeight}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <marker
          id={routeMarkerId}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 6 3 L 0 6 z" fill="currentColor" />
        </marker>
      </defs>

      {scene.lanes.map((lane) => (
        <line
          key={lane.laneId}
          x1={layout.laneCenterById.get(lane.laneId) ?? 0}
          y1={0}
          x2={layout.laneCenterById.get(lane.laneId) ?? 0}
          y2={renderedContentHeight}
          stroke="var(--color-graph-lane-line)"
          strokeWidth={2}
          strokeDasharray="3 8"
        />
      ))}

      {visibleRows.map((row) => {
        if (row.kind !== "event") {
          return null;
        }

        const guideY = layout.rowGuideYByEventId.get(row.eventId);
        if (guideY === undefined) {
          return null;
        }

        return (
          <line
            key={`guide-${row.eventId}`}
            data-slot="graph-row-guide"
            data-guide-kind={row.selected ? "selected" : row.inPath ? "active" : "default"}
            data-event-id={row.eventId}
            x1={TIME_GUTTER}
            y1={guideY}
            x2={layout.contentWidth}
            y2={guideY}
            stroke={
              row.selected
                ? "var(--color-graph-guide-selected)"
                : row.inPath
                  ? "var(--color-graph-guide-active)"
                  : "var(--color-graph-guide-default)"
            }
            strokeWidth={row.selected || row.inPath ? 1.25 : 1}
            strokeDasharray="2 6"
          />
        );
      })}

      {continuationGuideYs
        .filter(
          (guideY) =>
            guideY >= scrollTop - 500 && guideY <= scrollTop + availableCanvasHeight + 500,
        )
        .map((guideY) => (
          <line
            key={`continuation-guide-${guideY}`}
            data-slot="graph-row-guide"
            data-guide-kind="continuation"
            x1={TIME_GUTTER}
            y1={guideY}
            x2={layout.contentWidth}
            y2={guideY}
            stroke="var(--color-graph-guide-continuation)"
            strokeWidth={1}
            strokeDasharray="2 7"
          />
        ))}

      {visibleEdgeRoutes.map((route) => {
        const bundle = bundleById.get(route.bundleId);
        if (!bundle) {
          return null;
        }

        const strokeWidth = bundle.inPath || bundle.selected ? 3.5 : 2.5;
        const dashArray =
          bundle.edgeType === "handoff"
            ? "6 4"
            : bundle.edgeType === "transfer"
              ? "2 4"
              : bundle.edgeType === "merge"
                ? "1 3"
                : undefined;

        return (
          <g
            key={bundle.id}
            data-slot="graph-route"
            data-edge-type={bundle.edgeType}
            data-selected={bundle.selected ? "true" : "false"}
            data-in-path={bundle.inPath ? "true" : "false"}
            style={{
              color: resolveGraphEdgeColor(bundle.edgeType),
              opacity: bundle.inPath || bundle.selected ? 1 : 0.88,
            }}
          >
            <path
              d={route.path}
              markerEnd={`url(#${routeMarkerId})`}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={dashArray}
            />
            <circle
              data-slot="graph-route-port"
              data-port="source"
              cx={route.sourcePort.x}
              cy={route.sourcePort.y}
              r={4}
              fill="currentColor"
              stroke="var(--color-graph-port-outline)"
              strokeWidth={1.5}
            />
            <circle
              data-slot="graph-route-port"
              data-port="target"
              cx={route.targetPort.x}
              cy={route.targetPort.y}
              r={4}
              fill="currentColor"
              stroke="var(--color-graph-port-outline)"
              strokeWidth={1.5}
            />
          </g>
        );
      })}
    </svg>
  );
}
