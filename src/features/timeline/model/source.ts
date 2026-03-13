import type { CanonicalEvent, CanonicalSession } from "@/shared/canonical";
import type { SessionDetailSnapshot, TimelineLineageRelation } from "@/shared/queries";

export interface TimelineSource {
  events: CanonicalEvent[];
  lineageRelations: TimelineLineageRelation[];
  rootSessionId: string;
  sessions: CanonicalSession[];
  sessionsById: Record<string, CanonicalSession>;
}

export function parseTimelineTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const next = Date.parse(value);
  return Number.isNaN(next) ? null : next;
}

export function timelineMetaString(event: CanonicalEvent, key: string) {
  const value = event.meta[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function timelineEventOrder(left: CanonicalEvent, right: CanonicalEvent) {
  return (
    (parseTimelineTimestamp(left.occurred_at) ?? 0) - (parseTimelineTimestamp(right.occurred_at) ?? 0) ||
    left.event_id.localeCompare(right.event_id)
  );
}

export function resolveTimelineSource(detail: SessionDetailSnapshot): TimelineSource {
  const timeline = detail.timeline;
  const sessionsById = Object.fromEntries(
    timeline.sessions.map((session) => [session.session_id, session]),
  ) as Record<string, CanonicalSession>;

  return {
    events: [...timeline.events].sort(timelineEventOrder),
    lineageRelations: timeline.lineage_relations,
    rootSessionId: timeline.root_session_id,
    sessions: timeline.sessions,
    sessionsById,
  };
}
