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
] as const;

export const VIEW_MODES = ["graph", "waterfall", "map"] as const;
export const INSPECTOR_TABS = ["summary", "input", "output", "trace", "raw"] as const;
export const DRAWER_TABS = ["artifacts", "import", "raw", "log"] as const;
export const EDGE_TYPES = ["spawn", "handoff", "transfer", "merge"] as const;
export const RUN_ENVIRONMENTS = ["Desktop", "Import", "Live"] as const;
export const LIVE_MODES = ["imported", "live"] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type ViewMode = (typeof VIEW_MODES)[number];
export type InspectorTab = (typeof INSPECTOR_TABS)[number];
export type DrawerTab = (typeof DRAWER_TABS)[number];
export type EdgeType = (typeof EDGE_TYPES)[number];
export type RunEnvironment = (typeof RUN_ENVIRONMENTS)[number];
export type LiveMode = (typeof LIVE_MODES)[number];

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

export interface GapSegment {
  gapId: string;
  laneId: string;
  startTs: number;
  endTs: number;
  durationMs: number;
  hiddenCount: number;
  idleLaneCount: number;
}

export interface RunDataset {
  project: Project;
  session: Session;
  run: RunRecord;
  lanes: AgentLane[];
  events: EventRecord[];
  edges: EdgeRecord[];
  artifacts: ArtifactRecord[];
}

export interface RunFilters {
  agentId: string | null;
  eventType: EventType | "all";
  search: string;
  errorOnly: boolean;
}

export interface LaneDisplayItemEvent {
  kind: "event";
  event: EventRecord;
}

export interface LaneDisplayItemGap {
  kind: "gap";
  gap: GapSegment;
  events: EventRecord[];
}

export type LaneDisplayItem = LaneDisplayItemEvent | LaneDisplayItemGap;

export interface LaneDisplay {
  lane: AgentLane;
  items: LaneDisplayItem[];
  hiddenByDegradation: boolean;
}

export interface AnomalyJump {
  label: string;
  selection:
    | { kind: "event"; id: string }
    | { kind: "edge"; id: string }
    | { kind: "artifact"; id: string };
  emphasis: "default" | "warning" | "danger" | "accent";
}

export interface RunGroup {
  title: string;
  runs: RunDataset[];
}

export interface QuickFilterSummary {
  key: "all" | "live" | "waiting" | "failed";
  label: string;
  count: number;
}

export interface WorkspaceIdentityOverride {
  originPath: string;
  displayName: string;
  isWorktree: boolean;
}

export type WorkspaceIdentityOverrideMap = Record<string, WorkspaceIdentityOverride>;

export interface WorkspaceRunRow {
  id: string;
  title: string;
  status: RunStatus;
  lastEventSummary: string;
  relativeTime: string;
  liveMode: LiveMode;
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
  quickFilters: QuickFilterSummary[];
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
  dimmed: boolean;
}

export interface GraphSceneRowGap {
  kind: "gap";
  id: string;
  label: string;
  idleLaneCount: number;
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

export interface WaterfallSegment {
  eventId: string;
  laneId: string;
  title: string;
  leftPercent: number;
  widthPercent: number;
  status: RunStatus;
}

export interface WaterfallRowEvent {
  kind: "event";
  id: string;
  eventId: string;
  startLabel: string;
  durationLabel: string;
}

export interface WaterfallRowGap {
  kind: "gap";
  id: string;
  label: string;
}

export type WaterfallRow = WaterfallRowEvent | WaterfallRowGap;

export interface WaterfallCell {
  eventId: string;
  laneId: string;
  title: string;
  summary: string;
  status: RunStatus;
  waitReason: string | null;
  leftPercent: number;
  widthPercent: number;
  selected: boolean;
  inPath: boolean;
}

export interface WaterfallModel {
  lanes: GraphSceneLane[];
  rows: WaterfallRow[];
  cells: WaterfallCell[];
  selectionPath: SelectionPath;
}

export interface MapNode {
  lane: AgentLane;
  statusCount: number;
  blockedCount: number;
  waitingCount: number;
  doneCount: number;
}

export interface LiveWatchFrame {
  delayMs: number;
  events: EventRecord[];
  status?: RunStatus;
  connection?: "live" | "stale" | "disconnected" | "reconnected";
}

export interface InspectorFact {
  label: string;
  value: string;
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
}

export interface SelectionState {
  kind: "event" | "edge" | "artifact";
  id: string;
}
