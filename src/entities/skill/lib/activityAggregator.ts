import type { PromptLayer, RunDataset } from "../../run";
import type { FreshnessTag, SkillActivityItem, SkillCatalogEntry, SkillInvocationSummary, SkillTags, SourceTag } from "../model/types";
import { FRESHNESS_THRESHOLDS } from "../model/types";
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

function deriveFreshness(lastTs: number | null, now: number): FreshnessTag {
  if (lastTs === null) return "unused";
  const ageMs = now - lastTs;
  if (ageMs <= FRESHNESS_THRESHOLDS.activeWithinMs) return "active";
  if (ageMs <= FRESHNESS_THRESHOLDS.recentWithinMs) return "recent";
  return "stale";
}

function deriveTags(inCatalog: boolean, lastTs: number | null, now: number): SkillTags {
  const source: SourceTag = inCatalog ? "cataloged" : "unlisted";
  const freshness = deriveFreshness(lastTs, now);
  return { freshness, source };
}

interface BuildItemOptions {
  skillName: string;
  inCatalog: boolean;
  description: string;
  catalogSource: string | null;
  invocations: readonly SkillInvocationSummary[];
  now: number;
}

function sortInvocationsDesc(invocations: readonly SkillInvocationSummary[]): SkillInvocationSummary[] {
  return [...invocations].sort((a, b) => b.timestamp - a.timestamp);
}

function buildItemFromInvocations(opts: BuildItemOptions): SkillActivityItem {
  const sorted = sortInvocationsDesc(opts.invocations);
  const latest = sorted[0];

  return {
    skillName: opts.skillName,
    tags: deriveTags(opts.inCatalog, latest?.timestamp ?? null, opts.now),
    description: opts.description,
    invocationCount: opts.invocations.length,
    lastInvocationTs: latest?.timestamp ?? null,
    lastInvocationAgent: latest?.agentName ?? null,
    recentInvocations: sorted.slice(0, MAX_RECENT_INVOCATIONS),
    catalogSource: opts.catalogSource,
  };
}

function buildCatalogItems(
  catalog: Map<string, SkillCatalogEntry>,
  grouped: Map<string, SkillInvocationSummary[]>,
  now: number,
): SkillActivityItem[] {
  return [...catalog.entries()].map(([skillName, entry]) =>
    buildItemFromInvocations({ skillName, inCatalog: true, description: entry.description, catalogSource: entry.catalogSource, invocations: grouped.get(skillName) ?? [], now }),
  );
}

function buildUnlistedItems(
  catalog: ReadonlySet<string>,
  grouped: Map<string, SkillInvocationSummary[]>,
  now: number,
): SkillActivityItem[] {
  return [...grouped.entries()]
    .filter(([skillName]) => !catalog.has(skillName))
    .map(([skillName, invocations]) =>
      buildItemFromInvocations({ skillName, inCatalog: false, description: "", catalogSource: null, invocations, now }),
    );
}

export interface BuildSkillActivityOptions {
  datasets: readonly RunDataset[];
  activeRunId: string;
  externalInvocations?: readonly SkillInvocationSummary[];
  now?: number;
}

export function buildSkillActivityItems(opts: BuildSkillActivityOptions): SkillActivityItem[] {
  const { datasets, externalInvocations = [], now = Date.now() } = opts;
  const catalog = collectCatalogEntries(datasets);
  const knownSkillNames = new Set(catalog.keys());
  const datasetInvocations = datasets.flatMap((ds) => scanSkillInvocations(ds, knownSkillNames));
  const grouped = groupInvocationsBySkill([...datasetInvocations, ...externalInvocations]);
  return [...buildCatalogItems(catalog, grouped, now), ...buildUnlistedItems(knownSkillNames, grouped, now)];
}
