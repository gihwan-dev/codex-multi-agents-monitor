import type { AgentLane } from "../../run";
import { deriveSessionLogStatus } from "../lib/text";
import type { TimedSubagentSnapshot } from "./types";

type LaneStatus = AgentLane["laneStatus"];

export interface SubagentStatus {
  subError: string | null;
  subModel: string;
  subStatus: LaneStatus;
}

interface ResolveSubagentStatusOptions {
  subagent: TimedSubagentSnapshot;
  resolvedModel: string;
  waitAgentErrors: Map<string, string>;
}

export function resolveSubagentStatus(
  options: ResolveSubagentStatusOptions,
): SubagentStatus {
  const subModel = options.subagent.model ?? options.resolvedModel;
  const subError =
    options.subagent.error ??
    options.waitAgentErrors.get(options.subagent.sessionId) ??
    null;

  return {
    subError,
    subModel,
    subStatus: normalizeSubagentStatus(options.subagent, subError),
  };
}

function normalizeSubagentStatus(
  subagent: TimedSubagentSnapshot,
  subError: string | null,
): LaneStatus {
  const baseStatus = deriveSessionLogStatus(subagent.entries, true);
  if (subError && baseStatus !== "interrupted") {
    return "interrupted";
  }
  if (subagent.entries.length === 0 && !subError && baseStatus === "done") {
    return "running";
  }
  return baseStatus;
}
