import { useMemo, useRef, useState } from "react";

import { buildSessionFlowViewModel } from "@/features/session-flow/lib/build-session-flow-view-model";
import type { SessionFlowPayload } from "@/shared/types/contracts";
import { Button } from "@/shared/ui/button";

type SessionFlowDiagramProps = {
  flow: SessionFlowPayload;
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
  onHoverItem?: (itemId: string | null) => void;
};

type ViewBoxState = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function SessionFlowDiagram({
  flow,
  selectedItemId,
  onSelectItem,
  onHoverItem,
}: SessionFlowDiagramProps) {
  const viewModel = useMemo(() => buildSessionFlowViewModel(flow), [flow]);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState<ViewBoxState>({
    x: 0,
    y: 0,
    width: viewModel.width,
    height: viewModel.height,
  });
  const dragState = useRef<{
    pointerX: number;
    pointerY: number;
    viewBox: ViewBoxState;
  } | null>(null);

  function zoom(multiplier: number) {
    setViewBox((current) => {
      const nextWidth = current.width * multiplier;
      const nextHeight = current.height * multiplier;
      return {
        x: current.x - (nextWidth - current.width) / 2,
        y: current.y - (nextHeight - current.height) / 2,
        width: nextWidth,
        height: nextHeight,
      };
    });
  }

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
          <Button size="sm" variant="ghost" onClick={() => zoom(0.9)}>
            Zoom in
          </Button>
          <Button size="sm" variant="ghost" onClick={() => zoom(1.1)}>
            Zoom out
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setViewBox({
                x: 0,
                y: 0,
                width: viewModel.width,
                height: viewModel.height,
              })
            }
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2)/0.72)]">
        <svg
          aria-label="Session flow diagram"
          className="h-[420px] w-full cursor-grab touch-none"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          onWheel={(event) => {
            event.preventDefault();
            zoom(event.deltaY < 0 ? 0.92 : 1.08);
          }}
          onPointerDown={(event) => {
            dragState.current = {
              pointerX: event.clientX,
              pointerY: event.clientY,
              viewBox,
            };
          }}
          onPointerMove={(event) => {
            if (!dragState.current) {
              return;
            }

            const deltaX =
              ((dragState.current.pointerX - event.clientX) / 900) *
              dragState.current.viewBox.width;
            const deltaY =
              ((dragState.current.pointerY - event.clientY) / 420) *
              dragState.current.viewBox.height;
            setViewBox({
              ...dragState.current.viewBox,
              x: dragState.current.viewBox.x + deltaX,
              y: dragState.current.viewBox.y + deltaY,
            });
          }}
          onPointerUp={() => {
            dragState.current = null;
          }}
          onPointerLeave={() => {
            dragState.current = null;
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
              key={lane.lane_id}
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
              <g
                key={item.item_id}
                data-testid={`session-flow-item-${item.item_id}`}
                onClick={() => onSelectItem(item.item_id)}
                onMouseEnter={() => setHovered(item.item_id)}
                onMouseLeave={() => setHovered(null)}
              >
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
                <text x={x + 12} y={y + 18} fontSize={11} fill="hsl(var(--muted))">
                  {item.kind}
                </text>
                <text x={x + 12} y={y + 31} fontSize={13} fill="hsl(var(--fg))">
                  {truncate(item.summary ?? item.item_id, 22)}
                </text>
              </g>
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
