import type { PromptLayer, RunDataset } from "../../run";
import type { SkillActivityItem, SkillCatalogEntry, SkillInvocationSummary, SkillStatus } from "../model/types";
import { parseCatalogSkills } from "./catalogParser";
import { scanSkillInvocations } from "./invocationScanner";

const MAX_RECENT_INVOCATIONS = 10;

function addLayerEntriesToCatalog(layers: readonly PromptLayer[], catalog: Map<string, SkillCatalogEntry>): void {
  for (const layer of layers) {
    if (layer.layerType !== "skills-catalog") continue;
    for (const entry of parseCatalogSkills(layer)) {
      if (!catalog.has(entry.skillName)) {
        catalog.set(entry.skillName, entry);
      }
    }
  }
}

function collectCatalogEntries(datasets: readonly RunDataset[]): Map<string, SkillCatalogEntry> {
  const catalog = new Map<string, SkillCatalogEntry>();
  for (const ds of datasets) {
    if (ds.promptAssembly?.layers) {
      addLayerEntriesToCatalog(ds.promptAssembly.layers, catalog);
    }
  }
  return catalog;
}

function groupInvocationsBySkill(invocations: SkillInvocationSummary[]): Map<string, SkillInvocationSummary[]> {
  const grouped = new Map<string, SkillInvocationSummary[]>();
  for (const inv of invocations) {
    const list = grouped.get(inv.skillName);
    if (list) {
      list.push(inv);
    } else {
      grouped.set(inv.skillName, [inv]);
    }
  }
  return grouped;
}

function deriveStatus(inCatalog: boolean, currentRunCount: number, totalCount: number): SkillStatus {
  if (!inCatalog && totalCount > 0) return "unlisted";
  if (currentRunCount > 0) return "active-run";
  if (totalCount > 0) return "recently-used";
  if (inCatalog) return "never-seen";
  return "stale";
}

interface BuildItemOptions {
  skillName: string;
  inCatalog: boolean;
  description: string;
  catalogSource: string | null;
  invocations: readonly SkillInvocationSummary[];
  activeRunId: string;
}

function buildItemFromInvocations(opts: BuildItemOptions): SkillActivityItem {
  const sorted = [...opts.invocations].sort((a, b) => b.timestamp - a.timestamp);
  const currentRunInvocations = sorted.filter((inv) => inv.traceId === opts.activeRunId).length;

  return {
    skillName: opts.skillName,
    status: deriveStatus(opts.inCatalog, currentRunInvocations, opts.invocations.length),
    description: opts.description,
    invocationCount: opts.invocations.length,
    currentRunInvocations,
    lastInvocationTs: sorted[0]?.timestamp ?? null,
    lastInvocationAgent: sorted[0]?.agentName ?? null,
    recentInvocations: sorted.slice(0, MAX_RECENT_INVOCATIONS),
    catalogSource: opts.catalogSource,
  };
}

function buildCatalogItems(
  catalog: Map<string, SkillCatalogEntry>,
  grouped: Map<string, SkillInvocationSummary[]>,
  activeRunId: string,
): SkillActivityItem[] {
  return [...catalog.entries()].map(([skillName, entry]) =>
    buildItemFromInvocations({ skillName, inCatalog: true, description: entry.description, catalogSource: entry.catalogSource, invocations: grouped.get(skillName) ?? [], activeRunId }),
  );
}

function buildUnlistedItems(
  catalog: ReadonlySet<string>,
  grouped: Map<string, SkillInvocationSummary[]>,
  activeRunId: string,
): SkillActivityItem[] {
  return [...grouped.entries()]
    .filter(([skillName]) => !catalog.has(skillName))
    .map(([skillName, invocations]) =>
      buildItemFromInvocations({ skillName, inCatalog: false, description: "", catalogSource: null, invocations, activeRunId }),
    );
}

export interface BuildSkillActivityOptions {
  datasets: readonly RunDataset[];
  activeRunId: string;
  externalInvocations?: readonly SkillInvocationSummary[];
}

export function buildSkillActivityItems(opts: BuildSkillActivityOptions): SkillActivityItem[] {
  const { datasets, activeRunId, externalInvocations = [] } = opts;
  const catalog = collectCatalogEntries(datasets);
  const knownSkillNames = new Set(catalog.keys());
  const datasetInvocations = datasets.flatMap((ds) => scanSkillInvocations(ds, knownSkillNames));
  const grouped = groupInvocationsBySkill([...datasetInvocations, ...externalInvocations]);
  return [...buildCatalogItems(catalog, grouped, activeRunId), ...buildUnlistedItems(knownSkillNames, grouped, activeRunId)];
}
