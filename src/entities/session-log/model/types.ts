import type { LiveConnection, RunStatus } from "../../run";

export type SessionProvider = "codex" | "claude";

export interface SessionEntrySnapshot {
  timestamp: string;
  entryType: string;
  role: string | null;
  text: string | null;
  functionName: string | null;
  functionCallId: string | null;
  functionArgumentsPreview: string | null;
}

export interface SubagentSnapshot {
  provider: SessionProvider;
  sessionId: string;
  parentThreadId: string;
  depth: number;
  agentNickname: string;
  agentRole: string;
  model: string | null;
  maxContextWindowTokens?: number | null;
  startedAt: string;
  updatedAt: string;
  entries: SessionEntrySnapshot[];
  error?: string | null;
}

export interface PromptAssemblyLayerSnapshot {
  layerType: string;
  label: string;
  contentLength: number;
  preview: string;
  rawContent: string;
}

export interface SessionLogSnapshot {
  provider: SessionProvider;
  sessionId: string;
  workspacePath: string;
  originPath: string;
  displayName: string;
  startedAt: string;
  updatedAt: string;
  model: string | null;
  maxContextWindowTokens?: number | null;
  entries: SessionEntrySnapshot[];
  subagents?: SubagentSnapshot[];
  isArchived?: boolean;
  promptAssembly?: PromptAssemblyLayerSnapshot[];
}

export interface RecentSessionIndexItem {
  provider: SessionProvider;
  sessionId: string;
  workspacePath: string;
  originPath: string;
  displayName: string;
  startedAt: string;
  updatedAt: string;
  model: string | null;
  filePath: string;
  firstUserMessage: string | null;
  title: string;
  status: RunStatus;
  lastEventSummary: string;
}

export interface TimedSubagentSnapshot extends SubagentSnapshot {
  startedTs: number;
  updatedTs: number;
}

export interface ArchivedSessionIndexItem {
  provider: SessionProvider;
  sessionId: string;
  workspacePath: string;
  originPath: string;
  displayName: string;
  startedAt: string;
  updatedAt: string;
  model: string | null;
  messageCount: number;
  filePath: string;
  firstUserMessage: string | null;
}

export interface ArchivedSessionIndexResult {
  items: ArchivedSessionIndexItem[];
  total: number;
  hasMore: boolean;
}

export type RecentSessionLiveConnection = Exclude<LiveConnection, "paused">;

export interface RecentSessionLiveSubscription {
  subscriptionId: string;
}

export interface RecentSessionLiveUpdate {
  subscriptionId: string;
  filePath: string;
  connection: RecentSessionLiveConnection;
  snapshot?: SessionLogSnapshot;
}

export const NEW_THREAD_TITLE = "새 스레드";
