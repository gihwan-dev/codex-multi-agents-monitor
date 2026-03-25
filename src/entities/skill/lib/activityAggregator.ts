import type { PromptLayer, RunDataset } from "../../run";
import type { FreshnessTag, SkillActivityItem, SkillCatalogEntry, SkillInvocationSummary, SkillTags, SourceTag } from "../model/types";
import { FRESHNESS_THRESHOLDS } from "../model/types";
import { parseCatalogSkills } from "./catalogParser";
import { scanSkillInvocations } from "./invocationScanner";

const MAX_RECENT_INVOCATIONS = 10;

function addLayerEntries(
  layers: readonly PromptLayer[],
  catalog: Map<string, SkillCatalogEntry>,
): void {
  for (const layer of layers) {
    if (layer.layerType !== "skills-catalog") continue;
    for (const entry of parseCatalogSkills(layer)) {
      if (!catalog.has(entry.skillName)) {
        catalog.set(entry.skillName, entry);
      }
    }
  }
}

function collectCatalog(datasets: readonly RunDataset[]): Map<string, SkillCatalogEntry> {
  const catalog = new Map<string, SkillCatalogEntry>();
  for (const ds of datasets) {
    if (ds.promptAssembly?.layers) {
      addLayerEntries(ds.promptAssembly.layers, catalog);
    }
  }
  return catalog;
}

function groupBySkill(
  invocations: SkillInvocationSummary[],
): Map<string, SkillInvocationSummary[]> {
  const grouped = new Map<string, SkillInvocationSummary[]>();
  for (const inv of invocations) {
    const list = grouped.get(inv.skillName);
    if (list) list.push(inv);
    else grouped.set(inv.skillName, [inv]);
  }
  return grouped;
}

function deriveFreshness(lastTs: number | null, now: number): FreshnessTag {
  if (lastTs === null) return "unused";
  const age = now - lastTs;
  if (age <= FRESHNESS_THRESHOLDS.activeWithinMs) return "active";
  if (age <= FRESHNESS_THRESHOLDS.recentWithinMs) return "recent";
  return "stale";
}

function deriveTags(inCatalog: boolean, lastTs: number | null, now: number): SkillTags {
  const source: SourceTag = inCatalog ? "cataloged" : "unlisted";
  return { freshness: deriveFreshness(lastTs, now), source };
}

function latestInvocation(sorted: readonly SkillInvocationSummary[]): SkillInvocationSummary | undefined {
  return sorted[0];
}

interface ItemBuildInput {
  skillName: string;
  inCatalog: boolean;
  description: string;
  catalogSource: string | null;
  invocations: readonly SkillInvocationSummary[];
  now: number;
}

function buildItem(input: ItemBuildInput): SkillActivityItem {
  const sorted = [...input.invocations].sort((a, b) => b.timestamp - a.timestamp);
  const latest = latestInvocation(sorted);
  return {
    skillName: input.skillName,
    tags: deriveTags(input.inCatalog, latest?.timestamp ?? null, input.now),
    description: input.description,
    invocationCount: input.invocations.length,
    lastInvocationTs: latest?.timestamp ?? null,
    lastInvocationAgent: latest?.agentName ?? null,
    recentInvocations: sorted.slice(0, MAX_RECENT_INVOCATIONS),
    catalogSource: input.catalogSource,
  };
}

export interface BuildSkillActivityOptions {
  datasets: readonly RunDataset[];
  activeRunId: string;
  externalInvocations?: readonly SkillInvocationSummary[];
  now?: number;
}

export function buildSkillActivityItems(opts: BuildSkillActivityOptions): SkillActivityItem[] {
  const { datasets, externalInvocations = [], now = Date.now() } = opts;
  const catalog = collectCatalog(datasets);
  const known = new Set(catalog.keys());
  const all = datasets.flatMap((ds) => scanSkillInvocations(ds, known));
  const grouped = groupBySkill([...all, ...externalInvocations]);

  const catalogItems = [...catalog.entries()].map(([name, entry]) =>
    buildItem({ skillName: name, inCatalog: true, description: entry.description, catalogSource: entry.catalogSource, invocations: grouped.get(name) ?? [], now }),
  );
  const unlistedItems = [...grouped.entries()]
    .filter(([name]) => !known.has(name))
    .map(([name, invocations]) =>
      buildItem({ skillName: name, inCatalog: false, description: "", catalogSource: null, invocations, now }),
    );

  return [...catalogItems, ...unlistedItems];
}
