import type { RunDataset } from "../../run";
import type { SkillInvocationSummary } from "../model/types";

function resolveAgentName(dataset: RunDataset, agentId: string): string {
  return dataset.lanes.find((l) => l.agentId === agentId)?.name ?? agentId;
}

function isSkillLayer(layerType: string): boolean {
  return layerType === "skill";
}

const SKILL_LABEL_PREFIX = "Skill: ";

function extractSkillNameFromLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.startsWith(SKILL_LABEL_PREFIX)) {
    return trimmed.slice(SKILL_LABEL_PREFIX.length).trim();
  }
  return trimmed;
}

function buildLayerInvocation(label: string, layerId: string, dataset: RunDataset): SkillInvocationSummary | null {
  const skillName = extractSkillNameFromLabel(label);
  if (!skillName) return null;
  return { skillName, traceId: dataset.run.traceId, eventId: layerId, timestamp: dataset.run.startTs, agentName: dataset.session.owner };
}

function scanSkillLayers(dataset: RunDataset): SkillInvocationSummary[] {
  const layers = dataset.promptAssembly?.layers;
  if (!layers) return [];
  return layers
    .filter((layer) => isSkillLayer(layer.layerType))
    .map((layer) => buildLayerInvocation(layer.label, layer.layerId, dataset))
    .filter((inv): inv is SkillInvocationSummary => inv !== null);
}

function isSkillToolEvent(e: { eventType: string; toolName: string | null }, knownSkillNames: ReadonlySet<string>): boolean {
  return (e.eventType === "tool.started" || e.eventType === "tool.finished") && e.toolName !== null && knownSkillNames.has(e.toolName);
}

function scanToolEvents(dataset: RunDataset, knownSkillNames: ReadonlySet<string>): SkillInvocationSummary[] {
  return dataset.events
    .filter((e) => isSkillToolEvent(e, knownSkillNames))
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
