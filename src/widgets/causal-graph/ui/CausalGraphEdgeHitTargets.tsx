import type { GraphSceneEdgeBundle } from "../../../entities/run";
import type { EdgeRouteLayout, GraphLayoutSnapshot } from "../model/graphLayout";

interface CausalGraphEdgeHitTargetsProps {
  bundleById: Map<string, GraphSceneEdgeBundle>;
  layout: GraphLayoutSnapshot;
  onSelectEdge: (edgeId: string) => void;
  renderedContentHeight: number;
  visibleEdgeRoutes: EdgeRouteLayout[];
}

export function CausalGraphEdgeHitTargets({
  bundleById,
  layout,
  onSelectEdge,
  renderedContentHeight,
  visibleEdgeRoutes,
}: CausalGraphEdgeHitTargetsProps) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[2] h-full w-full overflow-visible"
      viewBox={`0 0 ${layout.contentWidth} ${renderedContentHeight}`}
      preserveAspectRatio="none"
    >
      <title>Interactive graph edge hit targets</title>
      {visibleEdgeRoutes.map((route) => {
        const bundle = bundleById.get(route.bundleId);
        if (!bundle) {
          return null;
        }

        return (
          <a
            key={`interactive-route-${route.bundleId}`}
            href={`#${bundle.primaryEdgeId}`}
            aria-label={`${bundle.edgeType} edge between ${bundle.sourceEventId} and ${bundle.targetEventId}`}
            onClick={(event) => {
              event.preventDefault();
              onSelectEdge(bundle.primaryEdgeId);
            }}
            onKeyDown={(event) => {
              if (event.key !== " ") {
                return;
              }

              event.preventDefault();
              onSelectEdge(bundle.primaryEdgeId);
            }}
          >
            <title>{`${bundle.edgeType}: ${bundle.label}`}</title>
            <path
              data-slot="graph-route-hitbox"
              data-edge-type={bundle.edgeType}
              d={route.path}
              fill="none"
              stroke="transparent"
              strokeWidth={20}
              pointerEvents="stroke"
            />
          </a>
        );
      })}
    </svg>
  );
}
