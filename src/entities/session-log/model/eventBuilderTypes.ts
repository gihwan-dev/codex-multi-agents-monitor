import type {
  AgentLane,
  EventRecord,
  EventType,
  RunStatus,
} from "../../run";
import type { SessionEntrySnapshot } from "./types";

export interface EntryContext {
  entry: SessionEntrySnapshot;
  lane: AgentLane;
  startTs: number;
  safeEndTs: number;
  isLatest: boolean;
  status: RunStatus;
  model: string;
  index: number;
}

export interface EntryEventOptions {
  eventType: EventType;
  title: string;
  inputPreview: string | null;
  outputPreview: string | null;
  toolName?: string;
  waitReason?: string;
  errorMessage?: string;
}

export interface MessageEventArgs {
  context: EntryContext;
  previousEntry: SessionEntrySnapshot | undefined;
  userLane: AgentLane | null;
  displayTitle: string;
  isSubagent: boolean;
  firstUserPromptSeen: boolean;
}

export interface MessageEventResult {
  event: EventRecord | null;
  firstUserPromptSeen: boolean;
}
