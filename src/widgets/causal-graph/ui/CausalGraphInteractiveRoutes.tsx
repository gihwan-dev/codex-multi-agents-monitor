import type { GraphSceneEdgeBundle } from "../../../entities/run";
import type { EdgeRouteLayout } from "../model/graphLayout";
import { InteractiveGraphRouteAnchor } from "./InteractiveGraphRouteAnchor";

interface CausalGraphInteractiveRoutesProps {
  bundleById: Map<string, GraphSceneEdgeBundle>;
  contentWidth: number;
  onSelectEdge: (edgeId: string) => void;
  renderedContentHeight: number;
  visibleEdgeRoutes: EdgeRouteLayout[];
}

export function CausalGraphInteractiveRoutes({
  bundleById,
  contentWidth,
  onSelectEdge,
  renderedContentHeight,
  visibleEdgeRoutes,
}: CausalGraphInteractiveRoutesProps) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[2] h-full w-full overflow-visible"
      viewBox={`0 0 ${contentWidth} ${renderedContentHeight}`}
      preserveAspectRatio="none"
    >
      <title>Interactive graph edge hit targets</title>
      {visibleEdgeRoutes.map((route) => {
        const bundle = bundleById.get(route.bundleId);
        if (!bundle) {
          return null;
        }

        return (
          <InteractiveGraphRouteAnchor key={`interactive-route-${route.bundleId}`} bundle={bundle} onSelectEdge={onSelectEdge} route={route} />
        );
      })}
    </svg>
  );
}
