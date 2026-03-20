import type { EventRecord, GraphSceneRow, SelectionState } from "../../../entities/run";
import { StatusChip } from "../../../shared/ui";
import { buildExpandedGapIds, buildExpandedGaps } from "../model/expandedGaps";

interface GapDetailSectionProps {
  rows: GraphSceneRow[];
  toggledGapIds: string[];
  events: EventRecord[];
  onSelect: (selection: SelectionState) => void;
  onCollapseGap: (gapId: string) => void;
}

export function GapDetailSection({
  rows,
  toggledGapIds,
  events,
  onSelect,
  onCollapseGap,
}: GapDetailSectionProps) {
  const expandedGapIds = buildExpandedGapIds(rows, toggledGapIds);
  const expandedGaps = buildExpandedGaps(rows, expandedGapIds, events);

  if (!expandedGaps.length) {
    return null;
  }

  return (
    <section className="gap-detail-section" aria-live="polite">
      {expandedGaps.map((gap) => (
        <details key={gap.gapId} className="gap-detail-section__group" open>
          <summary className="gap-detail-section__summary">
            <span>{gap.label}</span>
            <button
              type="button"
              className="button button--ghost gap-detail-section__collapse"
              onClick={(e) => {
                e.preventDefault();
                onCollapseGap(gap.gapId);
              }}
            >
              Collapse
            </button>
          </summary>
          {gap.hiddenEvents.length ? (
            <ul className="gap-detail-section__list">
              {gap.hiddenEvents.map((event) => (
                <li key={event.eventId} className="gap-detail-section__event">
                  <button
                    type="button"
                    className="gap-detail-section__event-button"
                    onClick={() => onSelect({ kind: "event", id: event.eventId })}
                  >
                    <span className="gap-detail-section__event-title">{event.title}</span>
                    <StatusChip status={event.status} subtle />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="gap-detail-section__empty">No hidden events in this gap.</p>
          )}
        </details>
      ))}
    </section>
  );
}
