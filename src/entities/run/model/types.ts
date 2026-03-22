export const RUN_STATUSES = [
  "queued",
  "running",
  "waiting",
  "blocked",
  "interrupted",
  "done",
  "failed",
  "cancelled",
  "stale",
  "disconnected",
] as const;

export const EVENT_TYPES = [
  "run.started",
  "run.finished",
  "run.failed",
  "run.cancelled",
  "agent.spawned",
  "agent.state_changed",
  "agent.finished",
  "llm.started",
  "llm.finished",
  "tool.started",
  "tool.finished",
  "handoff",
  "transfer",
  "error",
  "note",
  "user.prompt",
  "turn.started",
  "turn.finished",
] as const;

export const DRAWER_TABS = ["artifacts", "import", "context", "raw", "log"] as const;
export const EDGE_TYPES = ["spawn", "handoff", "transfer", "merge"] as const;
export const RUN_ENVIRONMENTS = ["Desktop", "Import", "Live"] as const;
export const LIVE_MODES = ["imported", "live"] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type DrawerTab = (typeof DRAWER_TABS)[number];
export type EdgeType = (typeof EDGE_TYPES)[number];
export type RunEnvironment = (typeof RUN_ENVIRONMENTS)[number];
export type LiveMode = (typeof LIVE_MODES)[number];
export type LiveConnection =
  | "live"
  | "stale"
  | "disconnected"
  | "reconnected"
  | "paused";

export interface Project {
  projectId: string;
  name: string;
  repoPath: string;
  badge?: string;
}

export interface Session {
  sessionId: string;
  title: string;
  owner: string;
  startedAt: number;
}

export interface SummaryMetrics {
  totalDurationMs: number;
  activeTimeMs: number;
  idleTimeMs: number;
  longestGapMs: number;
  agentCount: number;
  peakParallelism: number;
  llmCalls: number;
  toolCalls: number;
  tokens: number;
  costUsd: number;
  errorCount: number;
}

export interface RunRecord {
  traceId: string;
  title: string;
  status: RunStatus;
  startTs: number;
  endTs: number | null;
  durationMs: number;
  environment: RunEnvironment;
  liveMode: LiveMode;
  summaryMetrics: SummaryMetrics;
  finalArtifactId: string | null;
  selectedByDefaultId: string | null;
  rawIncluded: boolean;
  noRawStorage: boolean;
  isArchived: boolean;
}

export interface AgentLane {
  laneId: string;
  agentId: string;
  threadId: string;
  name: string;
  role: string;
  model: string;
  provider: string;
  badge: string;
  laneStatus: RunStatus;
  clusterId?: string;
}

export interface EventRecord {
  eventId: string;
  parentId: string | null;
  linkIds: string[];
  laneId: string;
  agentId: string;
  threadId: string;
  eventType: EventType;
  status: RunStatus;
  waitReason: string | null;
  retryCount: number;
  startTs: number;
  endTs: number | null;
  durationMs: number;
  title: string;
  inputPreview: string | null;
  outputPreview: string | null;
  artifactId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  provider: string | null;
  model: string | null;
  toolName: string | null;
  tokensIn: number;
  tokensOut: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  finishReason: string | null;
  rawInput: string | null;
  rawOutput: string | null;
}

export interface EdgeRecord {
  edgeId: string;
  edgeType: EdgeType;
  sourceAgentId: string;
  targetAgentId: string;
  sourceEventId: string;
  targetEventId: string;
  payloadPreview: string | null;
  artifactId: string | null;
}

export interface ArtifactRecord {
  artifactId: string;
  title: string;
  artifactRef: string;
  producerEventId: string;
  preview: string;
  rawContent: string | null;
}

export type PromptLayerType =
  | "system"
  | "permissions"
  | "app-context"
  | "collaboration-mode"
  | "apps"
  | "skills-catalog"
  | "agents"
  | "environment"
  | "automation"
  | "delegated"
  | "user"
  | "skill"
  | "subagent-notification";

export interface PromptLayer {
  layerId: string;
  layerType: PromptLayerType;
  label: string;
  preview: string;
  contentLength: number;
  rawContent: string | null;
}

export interface PromptAssembly {
  layers: PromptLayer[];
  totalContentLength: number;
}

export interface RunDataset {
  project: Project;
  session: Session;
  run: RunRecord;
  lanes: AgentLane[];
  events: EventRecord[];
  edges: EdgeRecord[];
  artifacts: ArtifactRecord[];
  promptAssembly?: PromptAssembly;
}

export interface AnomalyJump {
  label: string;
  selection:
    | { kind: "event"; id: string }
    | { kind: "edge"; id: string }
    | { kind: "artifact"; id: string };
  emphasis: "default" | "warning" | "danger" | "accent";
}

export type WorkspaceQuickFilterKey = "all" | "live" | "waiting" | "failed";

export interface WorkspaceRunRow {
  id: string;
  title: string;
  status: RunStatus;
  lastEventSummary: string;
  lastActivityTs: number;
  relativeTime: string;
  liveMode: LiveMode;
  filePath?: string | null;
}

export interface WorkspaceThreadGroup {
  id: string;
  title: string;
  runs: WorkspaceRunRow[];
}

export interface WorkspaceTreeItem {
  id: string;
  name: string;
  repoPath: string;
  badge: string | null;
  runCount: number;
  threads: WorkspaceThreadGroup[];
}

export interface WorkspaceTreeModel {
  workspaces: WorkspaceTreeItem[];
}

export interface SummaryFact {
  label: string;
  value: string;
  emphasis?: "default" | "warning" | "danger" | "accent";
}

export interface SelectionPath {
  eventIds: string[];
  edgeIds: string[];
  laneIds: string[];
}

export interface GraphSceneLane {
  laneId: string;
  name: string;
  role: string;
  model: string;
  badge: string;
  status: RunStatus;
}

export interface GraphSceneRowEvent {
  kind: "event";
  id: string;
  eventId: string;
  laneId: string;
  title: string;
  summary: string;
  status: RunStatus;
  waitReason: string | null;
  timeLabel: string;
  durationLabel: string;
  inPath: boolean;
  selected: boolean;
  eventType: EventType;
  toolName: string | null;
}

export interface GraphSceneRowGap {
  kind: "gap";
  id: string;
  label: string;
  idleLaneCount: number;
  durationMs: number;
  hiddenEventIds: string[];
}

export type GraphSceneRow = GraphSceneRowEvent | GraphSceneRowGap;

export interface GraphSceneEdgeBundle {
  id: string;
  primaryEdgeId: string;
  edgeIds: string[];
  sourceEventId: string;
  targetEventId: string;
  sourceLaneId: string;
  targetLaneId: string;
  edgeType: EdgeType;
  label: string;
  bundleCount: number;
  inPath: boolean;
  selected: boolean;
}

export interface GraphSceneModel {
  lanes: GraphSceneLane[];
  rows: GraphSceneRow[];
  edgeBundles: GraphSceneEdgeBundle[];
  selectionPath: SelectionPath;
  hiddenLaneCount: number;
  latestVisibleEventId: string | null;
}

export interface LiveWatchFrame {
  delayMs: number;
  events: EventRecord[];
  status?: RunStatus;
  connection?: Exclude<LiveConnection, "paused">;
}

export interface InspectorFact {
  label: string;
  value: string;
  emphasis?: "default" | "warning" | "danger" | "accent";
}

export interface InspectorJump {
  label: string;
  description: string;
  selection: SelectionState;
}

export interface InspectorCausalSummary {
  title: string;
  preview: string;
  facts: InspectorFact[];
  whyBlocked: string | null;
  upstream: InspectorJump[];
  downstream: InspectorJump[];
  nextAction: string | null;
  payloadPreview: string;
  rawStatusLabel: string;
  affectedAgentCount: number;
  downstreamWaitingCount: number;
}

export interface RawImportEvent {
  event_id: string;
  lane_id: string;
  agent_id: string;
  thread_id: string;
  parent_id?: string | null;
  event_type: EventType;
  status: RunStatus;
  wait_reason?: string | null;
  retry_count?: number;
  start_ts: number;
  end_ts?: number | null;
  title: string;
  input_preview?: string | null;
  output_preview?: string | null;
  input_raw?: string | null;
  output_raw?: string | null;
  artifact_id?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  provider?: string | null;
  model?: string | null;
  tool_name?: string | null;
  tokens_in?: number;
  tokens_out?: number;
  reasoning_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  cost_usd?: number;
  finish_reason?: string | null;
}

export interface RawImportPayload {
  project: Project;
  session: Session;
  run: Omit<RunRecord, "summaryMetrics" | "durationMs"> & {
    summaryMetrics?: Partial<SummaryMetrics>;
    durationMs?: number;
  };
  lanes: AgentLane[];
  events: RawImportEvent[];
  edges: EdgeRecord[];
  artifacts: ArtifactRecord[];
  promptAssembly?: PromptAssembly;
}

export interface SelectionState {
  kind: "event" | "edge" | "artifact";
  id: string;
}
