import type { KeyboardEvent } from "react";

import type { GraphSceneEdgeBundle } from "../../../entities/run";
import type { EdgeRouteLayout } from "../model/graphLayout";

interface InteractiveGraphRouteAnchorProps {
  bundle: GraphSceneEdgeBundle;
  onSelectEdge: (edgeId: string) => void;
  route: EdgeRouteLayout;
}

function formatEdgeTypeLabel(edgeType: GraphSceneEdgeBundle["edgeType"]) {
  switch (edgeType) {
    case "handoff":
      return "Handoff";
    case "spawn":
      return "Spawn";
    case "transfer":
      return "Transfer";
    case "merge":
      return "Merge";
  }
}

function buildEdgeAccessibleName(bundle: GraphSceneEdgeBundle) {
  const relationshipLabel = `${formatEdgeTypeLabel(bundle.edgeType)} from ${bundle.sourceDisplayName} to ${bundle.targetDisplayName}`;
  if (bundle.bundleCount === 1) {
    return relationshipLabel;
  }

  return `${relationshipLabel} (${bundle.bundleCount} edges)`;
}

function handleEdgeKeyDown(
  event: KeyboardEvent<HTMLAnchorElement>,
  edgeId: string,
  onSelectEdge: (edgeId: string) => void,
) {
  if (event.key !== " " && event.key !== "Enter") {
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
  const accessibleName = buildEdgeAccessibleName(bundle);

  return (
    <a
      href={`#${bundle.primaryEdgeId}`}
      aria-label={accessibleName}
      onClick={(event) => {
        event.preventDefault();
        onSelectEdge(bundle.primaryEdgeId);
      }}
      onKeyDown={(event) => handleEdgeKeyDown(event, bundle.primaryEdgeId, onSelectEdge)}
    >
      <title>{accessibleName}</title>
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
