import type { SelectionState, WaterfallModel } from "../../../shared/domain";
import { Panel, StatusChip } from "../../../shared/ui";

interface WaterfallViewProps {
  model: WaterfallModel;
  onSelect: (selection: SelectionState) => void;
}

export function WaterfallView({ model, onSelect }: WaterfallViewProps) {
  return (
    <Panel title="Waterfall" className="canvas-panel waterfall-panel">
      <div
        className="waterfall-grid"
        style={{ ["--waterfall-lanes" as string]: String(model.lanes.length || 1) }}
      >
        <div className="waterfall-grid__corner">Time</div>
        {model.lanes.map((lane) => (
          <header key={lane.laneId} className="waterfall-grid__lane">
            <strong>{lane.name}</strong>
            <span>
              {lane.role} · {lane.model}
            </span>
          </header>
        ))}

        {model.rows.map((row) =>
          row.kind === "gap" ? (
            <div key={row.id} className="waterfall-grid__gap-row">
              <div className="waterfall-grid__gap-label">Gap</div>
              <div
                className="waterfall-grid__gap-body"
                style={{ gridColumn: `span ${model.lanes.length}` }}
              >
                {row.label}
              </div>
            </div>
          ) : (
            <div key={row.id} className="waterfall-grid__event-row">
              <div className="waterfall-grid__time">
                <strong>{row.startLabel}</strong>
                <span>{row.durationLabel}</span>
              </div>
              {model.lanes.map((lane) => {
                const cell = model.cells.find(
                  (item) => item.eventId === row.eventId && item.laneId === lane.laneId,
                );

                if (!cell) {
                  return (
                    <div
                      key={`${row.id}:${lane.laneId}`}
                      className="waterfall-event waterfall-event--empty"
                      aria-hidden="true"
                    />
                  );
                }

                return (
                  <button
                    key={`${row.id}:${lane.laneId}`}
                    type="button"
                    className={[
                      "waterfall-event",
                      cell.selected ? "waterfall-event--selected" : "",
                      cell.inPath ? "waterfall-event--path" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => onSelect({ kind: "event", id: cell.eventId })}
                  >
                    <div
                      className={`waterfall-event__bar waterfall-event__bar--${cell.status}`}
                      style={{ left: `${cell.leftPercent}%`, width: `${cell.widthPercent}%` }}
                    />
                    <div className="waterfall-event__content">
                      <div className="waterfall-event__head">
                        <strong>{cell.title}</strong>
                        <StatusChip status={cell.status} subtle />
                      </div>
                      <p>{cell.summary}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ),
        )}
      </div>
    </Panel>
  );
}
