import type { EventRecord } from "./coreTypes.js";
import type { ContextObservabilityModel } from "./observabilityTypes.js";
import type {
  EdgeType,
  EventType,
  LiveConnection,
  LiveMode,
  RunStatus,
} from "./typeConstants.js";

export interface SelectionState {
  kind: "event" | "edge" | "artifact";
  id: string;
}

export interface AnomalyJump {
  label: string;
  selection: SelectionState;
  emphasis: "default" | "warning" | "danger" | "accent";
}

export type WorkspaceQuickFilterKey = "all" | "live" | "waiting" | "failed";
export type WorkspaceScoreSortKey = "recent" | "score";
export type WorkspaceScoreFilterKey = "all" | "scored" | "high";

export interface WorkspaceRunRow {
  id: string;
  title: string;
  provider: string | null;
  score: number | null;
  profileLabel?: string | null;
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
  inputPreview: string | null;
  outputPreview: string | null;
  status: RunStatus;
  waitReason: string | null;
  timeLabel: string;
  durationLabel: string;
  inPath: boolean;
  selected: boolean;
  eventType: EventType;
  toolName: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cumulativeContextTokens: number;
  contextWindowTokens: number;
  hasCompaction: boolean;
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
  sourceDisplayName: string;
  targetDisplayName: string;
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
  contextObservability: ContextObservabilityModel;
  selectionPath: SelectionPath;
  hiddenLaneCount: number;
  latestVisibleEventId: string | null;
}

export interface EventSelectionRevealTarget {
  kind: "event";
  eventId: string;
}

export interface EdgeSelectionRevealTarget {
  kind: "edge";
  edgeId: string;
  sourceEventId: string;
  targetEventId: string;
}

export interface ArtifactSelectionRevealTarget {
  kind: "artifact";
  artifactId: string;
  producerEventId: string;
}

export type GraphSelectionRevealTarget =
  | EventSelectionRevealTarget
  | EdgeSelectionRevealTarget
  | ArtifactSelectionRevealTarget;

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
  inputPreview: string | null;
  outputPreview: string | null;
  rawInput: string | null;
  rawOutput: string | null;
  rawStatusLabel: string;
  affectedAgentCount: number;
  downstreamWaitingCount: number;
}
