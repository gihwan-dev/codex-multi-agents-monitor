import type { CanonicalEvent } from "@/shared/canonical";
import type { SessionDetailSnapshot } from "@/shared/queries";

import type {
  TimelineItemKind,
  TimelineItemView,
  TimelineLaneColumn,
  TimelineLaneView,
  TimelineProjection,
  TimelineSelection,
} from "./types";

const LANE_ACCENTS: Record<TimelineLaneColumn, string> = {
  main: "from-emerald-300/78 via-emerald-200/62 to-emerald-100/36",
  other: "from-sky-300/74 via-cyan-200/58 to-sky-100/34",
  user: "from-amber-300/76 via-amber-200/58 to-amber-100/34",
};

type LaneSeed = {
  earliestAtMs: number;
  events: CanonicalEvent[];
  laneId: string;
};

function formatRoleLabel(role: string) {
  return role
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const next = Date.parse(value);
  return Number.isNaN(next) ? null : next;
}

function metaString(event: CanonicalEvent, key: string) {
  const value = event.meta[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function eventOrder(left: CanonicalEvent, right: CanonicalEvent) {
  return (
    (parseTimestamp(left.occurred_at) ?? 0) - (parseTimestamp(right.occurred_at) ?? 0) ||
    left.event_id.localeCompare(right.event_id)
  );
}

function itemOrder(left: TimelineItemView, right: TimelineItemView) {
  return (
    left.startedAtMs - right.startedAtMs ||
    (left.endedAtMs ?? left.startedAtMs) - (right.endedAtMs ?? right.startedAtMs) ||
    left.itemId.localeCompare(right.itemId)
  );
}

function laneLabel(seed: LaneSeed) {
  for (const event of seed.events) {
    const nickname = metaString(event, "agent_nickname");
    if (nickname) {
      return nickname;
    }
  }

  for (const event of seed.events) {
    const role = metaString(event, "agent_role");
    if (role) {
      return formatRoleLabel(role);
    }
  }

  if (seed.laneId === "user") {
    return "User";
  }

  return seed.laneId
    .replace(/^agent:/, "")
    .replace(/[-_:]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isMainLane(seed: LaneSeed) {
  if (seed.laneId === "main" || seed.laneId === "agent:main") {
    return true;
  }

  return seed.events.some((event) => metaString(event, "agent_role") === "main");
}

function itemKindForEvent(event: CanonicalEvent): TimelineItemKind {
  switch (event.kind) {
    case "agent_message":
    case "user_message":
    case "spawn":
      return "message";
    case "reasoning":
      return "reasoning";
    case "tool_call":
    case "tool_output":
    case "tool_span":
      return "tool";
    case "token_delta":
      return "token";
    case "turn_aborted":
    case "error":
      return "error";
    default:
      return "status";
  }
}

function itemLabelForEvent(event: CanonicalEvent) {
  if (event.kind === "user_message") {
    return "User prompt";
  }

  if (event.kind === "reasoning") {
    return "Reasoning";
  }

  if (event.kind === "token_delta") {
    return "Token snapshot";
  }

  return event.summary ?? event.kind.split("_").join(" ");
}

function buildSimpleItem(event: CanonicalEvent): TimelineItemView {
  const startedAtMs = parseTimestamp(event.occurred_at) ?? 0;
  const endedAtMs = event.duration_ms ? startedAtMs + event.duration_ms : null;

  return {
    detailLevel: event.detail_level,
    endedAt: endedAtMs ? new Date(endedAtMs).toISOString() : null,
    endedAtMs,
    inputPreview: event.kind === "tool_call" ? event.payload_preview : null,
    itemId: event.event_id,
    kind: itemKindForEvent(event),
    label: itemLabelForEvent(event),
    laneId: event.lane_id,
    meta: event.meta,
    outputPreview: event.kind === "tool_output" ? event.payload_preview : null,
    payloadPreview: event.payload_preview,
    sourceEvents: [event],
    startedAt: event.occurred_at,
    startedAtMs,
    summary: event.summary,
    tokenInput: event.token_input ?? 0,
    tokenOutput: event.token_output ?? 0,
  };
}

function buildMergedToolItem(callEvent: CanonicalEvent, outputEvent: CanonicalEvent) {
  const startedAtMs = parseTimestamp(callEvent.occurred_at) ?? 0;
  const endedAtMs =
    parseTimestamp(outputEvent.occurred_at) ??
    (callEvent.duration_ms ? startedAtMs + callEvent.duration_ms : null);

  return {
    detailLevel:
      outputEvent.detail_level === "raw" || callEvent.detail_level === "raw"
        ? "raw"
        : "diagnostic",
    endedAt: outputEvent.occurred_at,
    endedAtMs,
    inputPreview: callEvent.payload_preview,
    itemId: `tool:${metaString(callEvent, "call_id") ?? callEvent.event_id}`,
    kind: "tool",
    label: callEvent.summary ?? "Tool",
    laneId: callEvent.lane_id,
    meta: {
      ...callEvent.meta,
      ...outputEvent.meta,
      merged_tool_output: outputEvent.event_id,
    },
    outputPreview: outputEvent.payload_preview,
    payloadPreview: callEvent.payload_preview,
    sourceEvents: [callEvent, outputEvent],
    startedAt: callEvent.occurred_at,
    startedAtMs,
    summary: outputEvent.summary ?? callEvent.summary,
    tokenInput: (callEvent.token_input ?? 0) + (outputEvent.token_input ?? 0),
    tokenOutput: (callEvent.token_output ?? 0) + (outputEvent.token_output ?? 0),
  } satisfies TimelineItemView;
}

function shouldRenderEvent(event: CanonicalEvent) {
  return event.kind !== "token_delta";
}

function buildItems(events: CanonicalEvent[]) {
  const orderedEvents = [...events].sort(eventOrder);
  const pendingToolCalls = new Map<string, CanonicalEvent>();
  const items: TimelineItemView[] = [];

  for (const event of orderedEvents) {
    const callId = metaString(event, "call_id");

    if (event.kind === "tool_call" && callId) {
      pendingToolCalls.set(callId, event);
      continue;
    }

    if (event.kind === "tool_output" && callId) {
      const callEvent = pendingToolCalls.get(callId);
      if (callEvent) {
        pendingToolCalls.delete(callId);
        items.push(buildMergedToolItem(callEvent, event));
        continue;
      }
    }

    if (shouldRenderEvent(event)) {
      items.push(buildSimpleItem(event));
    }
  }

  for (const event of pendingToolCalls.values()) {
    items.push(buildSimpleItem(event));
  }

  return items.sort(itemOrder);
}

function buildLanes(events: CanonicalEvent[]) {
  const laneSeeds = new Map<string, LaneSeed>();

  for (const event of events) {
    const key = event.lane_id;
    const occurredAtMs = parseTimestamp(event.occurred_at) ?? 0;
    const existing = laneSeeds.get(key);

    if (existing) {
      existing.events.push(event);
      existing.earliestAtMs = Math.min(existing.earliestAtMs, occurredAtMs);
      continue;
    }

    laneSeeds.set(key, {
      earliestAtMs: occurredAtMs,
      events: [event],
      laneId: key,
    });
  }

  const ordered = [...laneSeeds.values()].sort((left, right) => {
    if (left.laneId === "user") {
      return -1;
    }
    if (right.laneId === "user") {
      return 1;
    }

    const leftMain = isMainLane(left);
    const rightMain = isMainLane(right);
    if (leftMain && !rightMain) {
      return -1;
    }
    if (!leftMain && rightMain) {
      return 1;
    }

    return left.earliestAtMs - right.earliestAtMs || left.laneId.localeCompare(right.laneId);
  });

  const mainLaneId = ordered.find(isMainLane)?.laneId ?? null;

  return ordered.map((seed) => {
    const column: TimelineLaneColumn =
      seed.laneId === "user" ? "user" : seed.laneId === mainLaneId ? "main" : "other";

    return {
      accentClass: LANE_ACCENTS[column],
      column,
      label: laneLabel(seed),
      laneId: seed.laneId,
    } satisfies TimelineLaneView;
  });
}

export function buildTimelineProjection(
  detail: SessionDetailSnapshot | null,
): TimelineProjection | null {
  if (!detail) {
    return null;
  }

  const events = [...detail.bundle.events].sort(eventOrder);
  const items = buildItems(events);
  const lanes = buildLanes(events);
  const startedAtMs =
    parseTimestamp(detail.bundle.session.started_at) ??
    items[0]?.startedAtMs ??
    Date.now();
  const latestItem = items[items.length - 1] ?? null;
  const latestAtMs =
    latestItem?.endedAtMs ??
    latestItem?.startedAtMs ??
    parseTimestamp(detail.last_event_at) ??
    startedAtMs;
  const sessionTokenTotals = detail.bundle.events.reduce(
    (totals, event) => ({
      input: totals.input + (event.token_input ?? 0),
      output: totals.output + (event.token_output ?? 0),
    }),
    { input: 0, output: 0 },
  );

  return {
    detail,
    items,
    itemsById: Object.fromEntries(items.map((item) => [item.itemId, item])),
    lanes,
    latestItemId: latestItem?.itemId ?? null,
    metrics: detail.bundle.metrics ?? [],
    session: detail.bundle.session,
    sessionTokenTotals,
    startedAtMs,
    timeRangeMs: Math.max(latestAtMs - startedAtMs, 1),
  };
}

export function resolveTimelineSelection(
  projection: TimelineProjection | null,
  selection: TimelineSelection,
) {
  if (!projection || selection.kind === "session") {
    return null;
  }

  return projection.itemsById[selection.itemId] ?? null;
}
