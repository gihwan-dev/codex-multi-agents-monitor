import type { EventRecord, RunDataset } from "../../run";
import type { SkillInvocationSummary } from "../model/types";

export function scanSkillInvocations(
  dataset: RunDataset,
  knownSkillNames: ReadonlySet<string> = new Set(),
): SkillInvocationSummary[] {
  return [...layerInvocations(dataset), ...toolInvocations(dataset, knownSkillNames)];
}

function layerInvocations(dataset: RunDataset): SkillInvocationSummary[] {
  const layers = dataset.promptAssembly?.layers;
  if (!layers) return [];
  return layers
    .filter((layer) => layer.layerType === "skill")
    .map((layer) => toLayerInvocation(dataset, layer.label, layer.layerId))
    .filter((inv): inv is SkillInvocationSummary => inv !== null);
}

function toLayerInvocation(
  dataset: RunDataset,
  label: string,
  layerId: string,
): SkillInvocationSummary | null {
  const skillName = parseSkillLabel(label);
  if (!skillName) return null;
  return {
    skillName,
    traceId: dataset.run.traceId,
    eventId: layerId,
    timestamp: dataset.run.startTs,
    agentName: dataset.session.owner,
  };
}

function parseSkillLabel(label: string): string {
  const prefix = "Skill: ";
  const trimmed = label.trim();
  return trimmed.startsWith(prefix) ? trimmed.slice(prefix.length).trim() : trimmed;
}

function toolInvocations(dataset: RunDataset, known: ReadonlySet<string>): SkillInvocationSummary[] {
  return dataset.events
    .filter((e) => isSkillTool(e, known))
    .map((e) => toToolInvocation(dataset, e));
}

function isSkillTool(e: EventRecord, known: ReadonlySet<string>): boolean {
  return (e.eventType === "tool.started" || e.eventType === "tool.finished") && e.toolName !== null && known.has(e.toolName);
}

function toToolInvocation(dataset: RunDataset, e: EventRecord): SkillInvocationSummary {
  return {
    skillName: e.toolName ?? "",
    traceId: dataset.run.traceId,
    eventId: e.eventId,
    timestamp: e.startTs,
    agentName: dataset.lanes.find((l) => l.agentId === e.agentId)?.name ?? e.agentId,
  };
}
