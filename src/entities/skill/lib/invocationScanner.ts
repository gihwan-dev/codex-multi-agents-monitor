import type { RunDataset } from "../../run";
import type { SkillInvocationSummary } from "../model/types";

const SKILL_LABEL_PREFIX = "Skill: ";

function resolveAgentName(dataset: RunDataset, agentId: string): string {
  return dataset.lanes.find((l) => l.agentId === agentId)?.name ?? agentId;
}

function extractSkillName(label: string): string {
  const trimmed = label.trim();
  return trimmed.startsWith(SKILL_LABEL_PREFIX) ? trimmed.slice(SKILL_LABEL_PREFIX.length).trim() : trimmed;
}

function toLayerInvocation(
  dataset: RunDataset,
  label: string,
  layerId: string,
): SkillInvocationSummary | null {
  const skillName = extractSkillName(label);
  if (!skillName) return null;
  return {
    skillName,
    traceId: dataset.run.traceId,
    eventId: layerId,
    timestamp: dataset.run.startTs,
    agentName: dataset.session.owner,
  };
}

function scanSkillLayers(dataset: RunDataset): SkillInvocationSummary[] {
  const layers = dataset.promptAssembly?.layers;
  if (!layers) return [];
  return layers
    .filter((layer) => layer.layerType === "skill")
    .map((layer) => toLayerInvocation(dataset, layer.label, layer.layerId))
    .filter((inv): inv is SkillInvocationSummary => inv !== null);
}

function isSkillToolEvent(
  eventType: string,
  toolName: string | null,
  known: ReadonlySet<string>,
): boolean {
  return (eventType === "tool.started" || eventType === "tool.finished") && toolName !== null && known.has(toolName);
}

function scanToolEvents(dataset: RunDataset, known: ReadonlySet<string>): SkillInvocationSummary[] {
  return dataset.events
    .filter((e) => isSkillToolEvent(e.eventType, e.toolName, known))
    .map((e) => ({
      skillName: e.toolName ?? "",
      traceId: dataset.run.traceId,
      eventId: e.eventId,
      timestamp: e.startTs,
      agentName: resolveAgentName(dataset, e.agentId),
    }));
}

export function scanSkillInvocations(
  dataset: RunDataset,
  knownSkillNames: ReadonlySet<string> = new Set(),
): SkillInvocationSummary[] {
  return [...scanSkillLayers(dataset), ...scanToolEvents(dataset, knownSkillNames)];
}
