import type { KeyboardEvent } from "react";
import type { GraphSceneEdgeBundle } from "../../../entities/run";
import type { EdgeRouteLayout } from "../model/graphLayout";

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
          <a
            key={`interactive-route-${route.bundleId}`}
            href={`#${bundle.primaryEdgeId}`}
            aria-label={`${bundle.edgeType} edge between ${bundle.sourceEventId} and ${bundle.targetEventId}`}
            onClick={(event) => {
              event.preventDefault();
              onSelectEdge(bundle.primaryEdgeId);
            }}
            onKeyDown={(event) =>
              handleEdgeKeyDown(event, bundle.primaryEdgeId, onSelectEdge)
            }
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

function handleEdgeKeyDown(
  event: KeyboardEvent<HTMLAnchorElement>,
  edgeId: string,
  onSelectEdge: (edgeId: string) => void,
) {
  if (event.key !== " ") {
    return;
  }

  event.preventDefault();
  onSelectEdge(edgeId);
}
