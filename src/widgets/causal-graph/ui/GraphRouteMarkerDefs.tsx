interface GraphRouteMarkerDefsProps {
  routeMarkerId: string;
}

export function GraphRouteMarkerDefs({ routeMarkerId }: GraphRouteMarkerDefsProps) {
  return (
    <defs>
      <marker id={routeMarkerId} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M 0 0 L 6 3 L 0 6 z" fill="currentColor" />
      </marker>
    </defs>
  );
}
