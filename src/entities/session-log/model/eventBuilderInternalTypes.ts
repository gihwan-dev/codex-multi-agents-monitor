import type { AgentLane, EventRecord, RunStatus } from "../../run";
import type { EntryContext } from "./eventBuilderTypes";
import type { SessionEntrySnapshot } from "./types";

export interface BuildLaneEventsArgs {
  entries: SessionEntrySnapshot[];
  lane: AgentLane;
  userLane: AgentLane | null;
  updatedAtTs: number;
  status: RunStatus;
  model: string;
  displayTitle: string;
  isSubagent?: boolean;
}

export interface BuildLaneEventLoopOptions
  extends Omit<BuildLaneEventsArgs, "isSubagent"> {
  isSubagent: boolean;
  callIdToName: Map<string, string>;
  lastValidEntryIndex: number;
}

export interface CreateEntryContextOptions {
  entries: SessionEntrySnapshot[];
  lane: AgentLane;
  updatedAtTs: number;
  status: RunStatus;
  model: string;
  index: number;
  lastValidEntryIndex: number;
}

export interface ProcessEntryContextOptions extends BuildLaneEventLoopOptions {
  index: number;
  events: EventRecord[];
  firstUserPromptSeen: boolean;
}

export interface ProcessedEntryContextOptions {
  entries: SessionEntrySnapshot[];
  context: EntryContext;
  callIdToName: Map<string, string>;
  userLane: AgentLane | null;
  displayTitle: string;
  isSubagent: boolean;
  events: EventRecord[];
  firstUserPromptSeen: boolean;
}

export interface SafeEndTimestampOptions {
  entries: SessionEntrySnapshot[];
  index: number;
  updatedAtTs: number;
  startTs: number;
}
