import type { TimelineProjection } from "@/features/timeline";

export interface CoordinationSnapshot {
  currentTurn: {
    detail: string;
    label: string;
  };
  latestCoordination: {
    detail: string;
    label: string;
  };
  participants: {
    detail: string;
    label: string;
  };
}

function connectorLabel(kind: TimelineProjection["connectors"][number]["kind"]) {
  switch (kind) {
    case "spawn":
      return "Spawn";
    case "handoff":
      return "Handoff";
    case "reply":
      return "Reply";
    case "complete":
      return "Complete";
  }
}

function latestAgentUpdate(projection: TimelineProjection) {
  return [...projection.items]
    .reverse()
    .find(
      (item) =>
        item.laneId !== "user" &&
        item.kind !== "token" &&
        (item.summary != null || item.label.trim().length > 0),
    );
}

function participantSummary(projection: TimelineProjection) {
  const latestTurn = projection.turnBands[projection.turnBands.length - 1] ?? null;
  const latestTurnLaneIds = new Set(
    (latestTurn?.itemIds ?? [])
      .map((itemId) => projection.itemsById[itemId]?.laneId ?? null)
      .filter((laneId): laneId is string => laneId != null && laneId !== "user"),
  );
  const lanes =
    latestTurnLaneIds.size > 0
      ? projection.lanes.filter((lane) => latestTurnLaneIds.has(lane.laneId))
      : projection.lanes.filter((lane) => lane.laneId !== "user");

  if (lanes.length === 0) {
    return {
      detail: "Main and worker lanes will appear when orchestration begins.",
      label: "No agent lanes yet",
    };
  }

  return {
    detail: lanes.map((lane) => lane.label).join(" · "),
    label: `${lanes.length} agent lane${lanes.length === 1 ? "" : "s"}`,
  };
}

export function deriveCoordinationSnapshot(
  projection: TimelineProjection | null,
): CoordinationSnapshot | null {
  if (!projection) {
    return null;
  }

  const latestTurn = projection.turnBands[projection.turnBands.length - 1] ?? null;
  const latestConnector = projection.connectors[projection.connectors.length - 1] ?? null;
  const latestUpdate = latestAgentUpdate(projection);
  const lanesById = Object.fromEntries(
    projection.lanes.map((lane) => [lane.laneId, lane.label]),
  ) as Record<string, string>;

  return {
    currentTurn: {
      detail: latestTurn?.summary ?? "Waiting for the first user-to-agent exchange.",
      label: latestTurn?.label ?? "No turn yet",
    },
    latestCoordination: latestConnector
      ? {
          detail:
            latestUpdate?.summary ??
            latestUpdate?.label ??
            "Latest cross-agent coordination is active in this session.",
          label: `${connectorLabel(latestConnector.kind)} · ${
            lanesById[latestConnector.sourceLaneId] ?? latestConnector.sourceLaneId
          } -> ${lanesById[latestConnector.targetLaneId] ?? latestConnector.targetLaneId}`,
        }
      : {
          detail:
            latestUpdate?.summary ??
            latestUpdate?.label ??
            "Agent-to-agent orchestration will appear here once collaboration starts.",
          label: "No cross-agent coordination yet",
        },
    participants: participantSummary(projection),
  };
}
