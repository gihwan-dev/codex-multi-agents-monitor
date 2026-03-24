import type {
  EdgeType,
  EventType,
  LiveMode,
  PromptLayerType,
  RunEnvironment,
  RunStatus,
} from "./typeConstants.js";

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
