import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildSessionFlowViewModel,
} from "@/features/session-flow/lib/build-session-flow-view-model";
import type { SessionFlowPayload } from "@/shared/types/contracts";
import { Button } from "@/shared/ui/button";
import { useSessionViewport } from "@/features/session-flow/ui/use-session-viewport";

type SessionFlowDiagramProps = {
  flow: SessionFlowPayload;
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
  onHoverItem?: (itemId: string | null) => void;
};

export function SessionFlowDiagram({
  flow,
  selectedItemId,
  onSelectItem,
  onHoverItem,
}: SessionFlowDiagramProps) {
  const viewModel = useMemo(() => buildSessionFlowViewModel(flow), [flow]);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewport = useSessionViewport({
    width: viewModel.width,
    height: viewModel.height,
  });

  useEffect(() => {
    viewport.syncBounds();
  }, [viewModel.height, viewModel.width]);

  function setHovered(itemId: string | null) {
    setHoveredItemId(itemId);
    onHoverItem?.(itemId);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
          Session Flow
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => viewport.zoom(0.9)}>
            Zoom in
          </Button>
          <Button size="sm" variant="ghost" onClick={() => viewport.zoom(1.1)}>
            Zoom out
          </Button>
          <Button size="sm" variant="ghost" onClick={() => viewport.reset()}>
            Reset
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2)/0.72)]">
        <svg
          ref={svgRef}
          aria-label="Session flow diagram"
          className="h-[420px] w-full cursor-grab touch-none"
          viewBox={`${viewport.viewBox.x} ${viewport.viewBox.y} ${viewport.viewBox.width} ${viewport.viewBox.height}`}
          onWheel={(event) => {
            event.preventDefault();
            viewport.zoom(event.deltaY < 0 ? 0.92 : 1.08);
          }}
          onPointerDown={(event) => {
            viewport.onPointerDown(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => {
            if (!svgRef.current) {
              return;
            }
            viewport.onPointerMove(
              event.clientX,
              event.clientY,
              svgRef.current.getBoundingClientRect(),
            );
          }}
          onPointerUp={() => {
            viewport.clearDrag();
          }}
          onPointerLeave={() => {
            viewport.clearDrag();
            setHovered(null);
          }}
        >
          <rect
            x={0}
            y={0}
            width={viewModel.width}
            height={viewModel.height}
            fill="hsl(var(--panel-2))"
          />

          {viewModel.columns.map((column) => (
            <g key={column.id}>
              <text
                x={column.x}
                y={32}
                fontSize={18}
                fontWeight={700}
                fill="hsl(var(--fg))"
              >
                {column.label}
              </text>
              <line
                x1={column.x + 70}
                y1={48}
                x2={column.x + 70}
                y2={viewModel.height - 40}
                stroke="hsl(var(--line))"
                strokeDasharray="6 8"
              />
            </g>
          ))}

          {viewModel.lanes.map((lane) => (
            <text
              key={lane.lane_key}
              x={lane.x}
              y={56}
              fontSize={11}
              fill="hsl(var(--muted))"
            >
              {lane.label}
            </text>
          ))}

          {viewModel.connectors.map((connector) => (
            <line
              key={connector.id}
              x1={connector.from_x}
              y1={connector.from_y}
              x2={connector.to_x}
              y2={connector.to_y}
              stroke="hsl(var(--accent-strong))"
              strokeWidth={2}
              opacity={0.45}
            />
          ))}

          {viewModel.items.map(({ item, x, y, width, height }) => {
            const selected = selectedItemId === item.item_id;
            const hovered = hoveredItemId === item.item_id;
            const fill = kindFill(item.kind);
            return (
              <a
                key={item.item_id}
                data-testid={`session-flow-item-${item.item_id}`}
                href={`#${item.item_id}`}
                aria-label={`${item.kind} ${item.summary ?? item.item_id}`}
                onClick={(event) => {
                  event.preventDefault();
                  onSelectItem(item.item_id);
                }}
                onMouseEnter={() => setHovered(item.item_id)}
                onMouseLeave={() => setHovered(null)}
              >
                <g>
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    rx={14}
                    fill={fill}
                    stroke={
                      selected || hovered
                        ? "hsl(var(--accent-strong))"
                        : "hsl(var(--line))"
                    }
                    strokeWidth={selected ? 3 : 1.5}
                  />
                  <text
                    x={x + 12}
                    y={y + 18}
                    fontSize={11}
                    fill="hsl(var(--muted))"
                  >
                    {item.kind}
                  </text>
                  <text
                    x={x + 12}
                    y={y + 31}
                    fontSize={13}
                    fill="hsl(var(--fg))"
                  >
                    {truncate(item.summary ?? item.item_id, 22)}
                  </text>
                </g>
              </a>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function kindFill(kind: SessionFlowPayload["items"][number]["kind"]) {
  switch (kind) {
    case "user_message":
      return "hsl(var(--accent)/0.22)";
    case "commentary":
      return "hsl(var(--panel)/0.96)";
    case "tool_call":
      return "hsl(var(--warn)/0.12)";
    case "wait":
      return "hsl(var(--line)/0.45)";
    case "spawn":
      return "hsl(var(--ok)/0.14)";
    case "final_answer":
      return "hsl(var(--ok)/0.22)";
  }
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}
