import type { KeyboardEvent } from "react";

import type { GraphSceneEdgeBundle } from "../../../entities/run";
import type { EdgeRouteLayout } from "../model/graphLayout";

interface InteractiveGraphRouteAnchorProps {
  bundle: GraphSceneEdgeBundle;
  onSelectEdge: (edgeId: string) => void;
  route: EdgeRouteLayout;
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

export function InteractiveGraphRouteAnchor({
  bundle,
  onSelectEdge,
  route,
}: InteractiveGraphRouteAnchorProps) {
  return (
    <a
      href={`#${bundle.primaryEdgeId}`}
      aria-label={`${bundle.edgeType} edge between ${bundle.sourceEventId} and ${bundle.targetEventId}`}
      onClick={(event) => {
        event.preventDefault();
        onSelectEdge(bundle.primaryEdgeId);
      }}
      onKeyDown={(event) => handleEdgeKeyDown(event, bundle.primaryEdgeId, onSelectEdge)}
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
}
