import { invokeTauri } from "../../../shared/api";
import type { SkillInvocationSummary } from "../model/types";

interface SkillInvocationRecord {
  skillName: string;
  sessionId: string;
  timestamp: string;
}

interface SkillActivityScanResult {
  invocations: SkillInvocationRecord[];
}

function toInvocationSummary(record: SkillInvocationRecord): SkillInvocationSummary {
  return {
    skillName: record.skillName,
    traceId: record.sessionId,
    eventId: `scan:${record.sessionId}:${record.skillName}`,
    timestamp: new Date(record.timestamp).getTime() || 0,
    agentName: "",
  };
}

export async function loadSkillActivityScan(limit: number): Promise<SkillInvocationSummary[]> {
  try {
    const result = await invokeTauri<SkillActivityScanResult>("scan_skill_activity", { limit });
    return result.invocations.map(toInvocationSummary);
  } catch {
    return [];
  }
}
