import type {
  SessionFlowColumn,
  SessionFlowItem,
  SessionFlowPayload,
  SessionLane,
  SessionLaneRef,
} from "@/shared/types/contracts";

const HEADER_Y = 72;
const ITEM_ROW_HEIGHT = 84;
const ITEM_WIDTH = 140;
const ITEM_HEIGHT = 40;
const COLUMN_BASE_X: Record<SessionFlowColumn, number> = {
  user: 72,
  main: 340,
  subagent: 608,
};

export type SessionFlowViewModel = {
  width: number;
  height: number;
  columns: {
    id: SessionFlowColumn;
    label: string;
    x: number;
  }[];
  lanes: {
    lane_key: string;
    label: string;
    column: SessionFlowColumn;
    x: number;
  }[];
  items: {
    item: SessionFlowItem;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  connectors: {
    id: string;
    from_x: number;
    from_y: number;
    to_x: number;
    to_y: number;
  }[];
};

export function buildSessionFlowViewModel(
  flow: SessionFlowPayload,
): SessionFlowViewModel {
  const sortedSubagentLanes = flow.lanes.filter(
    (lane) => lane.column === "subagent",
  );
  const lanes = flow.lanes.map((lane) => buildLaneLayout(lane, sortedSubagentLanes));
  const laneMap = new Map(lanes.map((lane) => [lane.lane_key, lane]));
  const items = flow.items.map((item, index) => {
    const lane = laneMap.get(getSessionLaneKey(item.lane));
    const x = lane?.x ?? COLUMN_BASE_X.main;
    return {
      item,
      x,
      y: HEADER_Y + index * ITEM_ROW_HEIGHT,
      width: ITEM_WIDTH,
      height: ITEM_HEIGHT,
    };
  });
  const itemMap = new Map(items.map((item) => [item.item.item_id, item]));
  const connectors = flow.items
    .filter((item) => item.kind === "wait" && item.target_lane)
    .map((item) => {
      const source = itemMap.get(item.item_id);
      const target = item.target_lane
        ? laneMap.get(getSessionLaneKey(item.target_lane))
        : null;
      if (!source || !target) {
        return null;
      }

      return {
        id: `connector-${item.item_id}`,
        from_x: source.x + source.width,
        from_y: source.y + source.height / 2,
        to_x: target.x,
        to_y: source.y + source.height / 2,
      };
    })
    .filter((connector): connector is NonNullable<typeof connector> =>
      Boolean(connector),
    );

  return {
    width: Math.max(
      980,
      COLUMN_BASE_X.subagent + Math.max(sortedSubagentLanes.length, 1) * 120,
    ),
    height: Math.max(420, HEADER_Y + items.length * ITEM_ROW_HEIGHT + 80),
    columns: [
      { id: "user", label: "User", x: COLUMN_BASE_X.user },
      { id: "main", label: "Main", x: COLUMN_BASE_X.main },
      { id: "subagent", label: "Subagents", x: COLUMN_BASE_X.subagent },
    ],
    lanes,
    items,
    connectors,
  };
}

function buildLaneLayout(
  lane: SessionLane,
  sortedSubagentLanes: SessionLane[],
) {
  return {
    lane_key: getSessionLaneKey(lane.lane_ref),
    label: lane.label,
    column: lane.column,
    x:
      lane.column === "subagent"
        ? COLUMN_BASE_X.subagent +
          sortedSubagentLanes.findIndex(
            (candidate) =>
              getSessionLaneKey(candidate.lane_ref) ===
              getSessionLaneKey(lane.lane_ref),
          ) *
            92
        : COLUMN_BASE_X[lane.column],
  };
}

export function getSessionLaneKey(laneRef: SessionLaneRef): string {
  switch (laneRef.kind) {
    case "user":
      return "user";
    case "main":
      return `main:${laneRef.session_id}`;
    case "subagent":
      return `subagent:${laneRef.agent_session_id}`;
  }
}
