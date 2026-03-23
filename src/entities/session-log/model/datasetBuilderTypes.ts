import type { AgentLane, EdgeRecord, EventRecord, RunDataset } from "../../run";

export interface SnapshotTiming {
  startTs: number;
  updatedTs: number;
}

export interface ParentRunContext {
  displayTitle: string;
  status: RunDataset["run"]["status"];
  resolvedModel: string;
  userLane: AgentLane;
  mainLane: AgentLane;
  parentEvents: EventRecord[];
  runStartEvent: EventRecord;
  runEndEvent: EventRecord | null;
}

export interface CombinedTimeline {
  lanes: AgentLane[];
  events: EventRecord[];
  edges: EdgeRecord[];
  selectedByDefaultId: string;
}
