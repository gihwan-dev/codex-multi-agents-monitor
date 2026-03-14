import { type EventRecord, formatDuration, formatTimestamp, type SelectionState } from "../domain";
import { StatusChip } from "./StatusChip";

interface EventRowProps {
  event: EventRecord;
  selected: boolean;
  onSelect: (selection: SelectionState) => void;
}

export function EventRow({ event, selected, onSelect }: EventRowProps) {
  return (
    <button
      type="button"
      className={`event-row ${selected ? "event-row--selected" : ""}`.trim()}
      onClick={() => onSelect({ kind: "event", id: event.eventId })}
    >
      <div className="event-row__meta">
        <span className="event-row__time">{formatTimestamp(event.startTs)}</span>
        <span className="event-row__duration">{formatDuration(event.durationMs)}</span>
      </div>
      <div className="event-row__body">
        <div className="event-row__headline">
          <strong>{event.title}</strong>
          <StatusChip status={event.status} subtle />
        </div>
        <p>{event.outputPreview ?? event.inputPreview ?? "n/a"}</p>
        {event.waitReason ? (
          <span className="event-row__callout">wait_reason: {event.waitReason}</span>
        ) : null}
      </div>
    </button>
  );
}
