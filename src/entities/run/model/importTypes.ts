import type {
  AgentLane,
  ArtifactRecord,
  EdgeRecord,
  Project,
  PromptAssembly,
  RunRecord,
  Session,
  SummaryMetrics,
} from "./coreTypes.js";
import type { EventType, RunStatus } from "./typeConstants.js";

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
