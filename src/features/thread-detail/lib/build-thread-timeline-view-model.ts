import type { ThreadDetail } from "@/shared/types/contracts";

const MARKER_KINDS = new Set(["commentary", "spawn", "final"] as const);
const MIN_WINDOW_MS = 1_000;
const MIN_VISIBLE_WIDTH_PCT = 1.6;

export type ThreadTimelineLaneKind = "main" | "agent";
export type ThreadTimelineBlockKind = "wait" | "tool";
export type ThreadTimelineMarkerKind = "commentary" | "spawn" | "final";

export type ThreadTimelineWindow = {
  started_at: string;
  ended_at: string;
  started_at_ms: number;
  ended_at_ms: number;
  duration_ms: number;
};

export type ThreadTimelineGeometry = {
  left_pct: number;
  width_pct: number;
};

export type ThreadTimelineSessionBar = {
  started_at: string;
  ended_at: string | null;
  open: boolean;
  geometry: ThreadTimelineGeometry;
};

export type ThreadTimelineBlock = {
  id: string;
  lane_id: string;
  kind: ThreadTimelineBlockKind;
  label: string;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  open: boolean;
  geometry: ThreadTimelineGeometry;
};

export type ThreadTimelineMarker = {
  id: string;
  lane_id: string;
  kind: ThreadTimelineMarkerKind;
  started_at: string;
  summary: string | null;
  position_pct: number;
};

export type ThreadTimelineConnector = {
  id: string;
  parent_lane_id: string;
  child_lane_id: string;
  source_left_pct: number;
  target_left_pct: number;
};

export type ThreadTimelineLane = {
  id: string;
  kind: ThreadTimelineLaneKind;
  label: string;
  caption: string;
  session_bar: ThreadTimelineSessionBar | null;
  blocks: ThreadTimelineBlock[];
  markers: ThreadTimelineMarker[];
};

export type ThreadTimelineViewModel = {
  thread_id: string;
  title: string;
  status: ThreadDetail["thread"]["status"];
  window: ThreadTimelineWindow;
  lanes: ThreadTimelineLane[];
  markers: ThreadTimelineMarker[];
  connectors: ThreadTimelineConnector[];
};

export function buildThreadTimelineViewModel(
  detail: ThreadDetail,
): ThreadTimelineViewModel {
  const window = buildWindow(detail);
  const mainLaneId = detail.thread.thread_id;

  const sortedAgents = [...detail.agents].sort((left, right) => {
    return (
      left.depth - right.depth ||
      compareOptionalTimestamp(left.started_at, right.started_at) ||
      left.session_id.localeCompare(right.session_id)
    );
  });

  const lanes: ThreadTimelineLane[] = [
    {
      id: mainLaneId,
      kind: "main",
      label: "main thread",
      caption:
        detail.thread.latest_activity_summary ??
        detail.thread.cwd ??
        "latest activity 없음",
      session_bar: null,
      blocks: [],
      markers: [],
    },
    ...sortedAgents.map((agent) => {
      const startedAt =
        agent.started_at ?? detail.thread.started_at ?? window.started_at;
      const endedAt = agent.updated_at ?? null;
      const captionParts = [
        agent.agent_role ? agent.agent_role : `depth ${agent.depth}`,
        agent.started_at ? `started ${formatTime(agent.started_at)}` : null,
      ].filter(Boolean);

      return {
        id: agent.session_id,
        kind: "agent" as const,
        label: agent.agent_nickname ?? agent.agent_role ?? agent.session_id,
        caption: captionParts.join(" • "),
        session_bar: {
          started_at: startedAt,
          ended_at: endedAt,
          open: endedAt === null,
          geometry: buildSpanGeometry(
            toTimestampMs(startedAt) ?? window.started_at_ms,
            toTimestampMs(endedAt) ?? window.ended_at_ms,
            window,
          ),
        },
        blocks: [],
        markers: [],
      };
    }),
  ];

  const laneById = new Map(lanes.map((lane) => [lane.id, lane]));

  const blocks: ThreadTimelineBlock[] = [
    ...detail.wait_spans.map((span, index) => {
      const laneId = laneById.has(span.parent_session_id)
        ? span.parent_session_id
        : mainLaneId;

      return {
        id: `wait-${index}`,
        lane_id: laneId,
        kind: "wait" as const,
        label: span.child_session_id
          ? `wait ${span.child_session_id}`
          : "wait (child unknown)",
        started_at: span.started_at,
        ended_at: span.ended_at,
        duration_ms: span.duration_ms,
        open: span.ended_at === null,
        geometry: buildSpanGeometry(
          toTimestampMs(span.started_at) ?? window.started_at_ms,
          toTimestampMs(span.ended_at) ?? window.ended_at_ms,
          window,
        ),
      };
    }),
    ...detail.tool_spans.map((span, index) => {
      const laneId =
        span.agent_session_id && laneById.has(span.agent_session_id)
          ? span.agent_session_id
          : mainLaneId;

      return {
        id: `tool-${index}`,
        lane_id: laneId,
        kind: "tool" as const,
        label: span.tool_name,
        started_at: span.started_at,
        ended_at: span.ended_at,
        duration_ms: span.duration_ms,
        open: span.ended_at === null,
        geometry: buildSpanGeometry(
          toTimestampMs(span.started_at) ?? window.started_at_ms,
          toTimestampMs(span.ended_at) ?? window.ended_at_ms,
          window,
        ),
      };
    }),
  ];

  const markers = detail.timeline_events
    .filter(
      (event): event is typeof event & { kind: ThreadTimelineMarkerKind } =>
        MARKER_KINDS.has(event.kind as ThreadTimelineMarkerKind),
    )
    .map((event) => {
      const laneId =
        event.agent_session_id && laneById.has(event.agent_session_id)
          ? event.agent_session_id
          : mainLaneId;

      return {
        id: event.event_id,
        lane_id: laneId,
        kind: event.kind,
        started_at: event.started_at,
        summary: event.summary,
        position_pct: buildMarkerPosition(
          toTimestampMs(event.started_at) ?? window.started_at_ms,
          window,
        ),
      };
    })
    .sort((left, right) => {
      return (
        compareRequiredTimestamp(left.started_at, right.started_at) ||
        left.id.localeCompare(right.id)
      );
    });

  const connectors = detail.wait_spans
    .map((span, index) => {
      if (!span.child_session_id || !laneById.has(span.child_session_id)) {
        return null;
      }

      const waitBlock = blocks.find((block) => block.id === `wait-${index}`);
      const childLane = laneById.get(span.child_session_id);
      if (!waitBlock || !childLane?.session_bar) {
        return null;
      }

      return {
        id: `connector-${index}`,
        parent_lane_id: waitBlock.lane_id,
        child_lane_id: span.child_session_id,
        source_left_pct:
          waitBlock.geometry.left_pct + waitBlock.geometry.width_pct,
        target_left_pct: childLane.session_bar.geometry.left_pct,
      };
    })
    .filter(
      (connector): connector is ThreadTimelineConnector => connector !== null,
    );

  for (const lane of lanes) {
    lane.blocks = blocks.filter((block) => block.lane_id === lane.id);
    lane.markers = markers.filter((marker) => marker.lane_id === lane.id);
  }

  return {
    thread_id: detail.thread.thread_id,
    title: detail.thread.title,
    status: detail.thread.status,
    window,
    lanes,
    markers,
    connectors,
  };
}

function buildWindow(detail: ThreadDetail): ThreadTimelineWindow {
  const starts: number[] = [];
  const ends: number[] = [];

  collectTimestamp(starts, detail.thread.started_at);
  collectTimestamp(ends, detail.thread.updated_at);

  for (const agent of detail.agents) {
    collectTimestamp(starts, agent.started_at);
    collectTimestamp(ends, agent.updated_at);
  }

  for (const event of detail.timeline_events) {
    collectTimestamp(starts, event.started_at);
    collectTimestamp(ends, event.ended_at);
  }

  for (const span of detail.wait_spans) {
    collectTimestamp(starts, span.started_at);
    collectTimestamp(ends, span.ended_at);
  }

  for (const span of detail.tool_spans) {
    collectTimestamp(starts, span.started_at);
    collectTimestamp(ends, span.ended_at);
  }

  const earliest =
    starts.length > 0
      ? Math.min(...starts)
      : ends.length > 0
        ? Math.min(...ends)
        : 0;
  const latestCandidate = [...starts, ...ends];
  const latest =
    latestCandidate.length > 0 ? Math.max(...latestCandidate) : earliest;
  const endedAtMs = latest > earliest ? latest : earliest + MIN_WINDOW_MS;

  return {
    started_at: new Date(earliest).toISOString(),
    ended_at: new Date(endedAtMs).toISOString(),
    started_at_ms: earliest,
    ended_at_ms: endedAtMs,
    duration_ms: Math.max(endedAtMs - earliest, MIN_WINDOW_MS),
  };
}

function collectTimestamp(target: number[], value: string | null) {
  const timestamp = toTimestampMs(value);
  if (timestamp !== null) {
    target.push(timestamp);
  }
}

function buildSpanGeometry(
  startedAtMs: number,
  endedAtMs: number,
  window: ThreadTimelineWindow,
): ThreadTimelineGeometry {
  const start = clamp(startedAtMs, window.started_at_ms, window.ended_at_ms);
  const end = clamp(
    Math.max(endedAtMs, startedAtMs),
    window.started_at_ms,
    window.ended_at_ms,
  );
  const left = ((start - window.started_at_ms) / window.duration_ms) * 100;
  const unclampedWidth =
    ((Math.max(end, start) - start) / window.duration_ms) * 100;
  const width = Math.min(
    Math.max(unclampedWidth, MIN_VISIBLE_WIDTH_PCT),
    Math.max(100 - left, MIN_VISIBLE_WIDTH_PCT),
  );

  return {
    left_pct: left,
    width_pct: width,
  };
}

function buildMarkerPosition(
  startedAtMs: number,
  window: ThreadTimelineWindow,
) {
  return clamp(
    ((startedAtMs - window.started_at_ms) / window.duration_ms) * 100,
    0,
    100,
  );
}

function compareOptionalTimestamp(left: string | null, right: string | null) {
  const leftMs = toTimestampMs(left);
  const rightMs = toTimestampMs(right);
  if (leftMs === null && rightMs === null) {
    return 0;
  }

  if (leftMs === null) {
    return 1;
  }

  if (rightMs === null) {
    return -1;
  }

  return leftMs - rightMs;
}

function compareRequiredTimestamp(left: string, right: string) {
  return (toTimestampMs(left) ?? 0) - (toTimestampMs(right) ?? 0);
}

function toTimestampMs(value: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
