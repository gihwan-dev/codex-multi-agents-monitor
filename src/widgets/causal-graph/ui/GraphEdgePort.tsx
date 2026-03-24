interface GraphEdgePortProps {
  cx: number;
  cy: number;
  port: "source" | "target";
}

export function GraphEdgePort({ cx, cy, port }: GraphEdgePortProps) {
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
