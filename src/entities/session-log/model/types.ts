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
  sessionId: string;
  parentThreadId: string;
  depth: number;
  agentNickname: string;
  agentRole: string;
  model: string | null;
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
  sessionId: string;
  workspacePath: string;
  originPath: string;
  displayName: string;
  startedAt: string;
  updatedAt: string;
  model: string | null;
  entries: SessionEntrySnapshot[];
  subagents?: SubagentSnapshot[];
  isArchived?: boolean;
  promptAssembly?: PromptAssemblyLayerSnapshot[];
}

export interface TimedSubagentSnapshot extends SubagentSnapshot {
  startedTs: number;
  updatedTs: number;
}

export interface ArchivedSessionIndexItem {
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

export const NEW_THREAD_TITLE = "새 스레드";
