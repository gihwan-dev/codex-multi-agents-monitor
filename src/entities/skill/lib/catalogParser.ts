import type { PromptLayer } from "../../run";
import type { SkillCatalogEntry } from "../model/types";

const SKILL_LINK_PATTERN = /\[([^\]]+)\]\([^)]*SKILL\.md[^)]*\)/g;
const SKILL_BULLET_PATTERN = /^[-*]\s+(\S+):\s*(.+)$/gm;

interface CollectorState {
  seen: Set<string>;
  entries: SkillCatalogEntry[];
  catalogSource: string;
}

function addMatch(state: CollectorState, rawName: string, description: string): void {
  const trimmed = rawName.replace(/^\$/, "").trim();
  if (trimmed && !state.seen.has(trimmed)) {
    state.seen.add(trimmed);
    state.entries.push({ skillName: trimmed, description, catalogSource: state.catalogSource });
  }
}

function extractSkillLinks(text: string, catalogSource: string): SkillCatalogEntry[] {
  const state: CollectorState = { seen: new Set(), entries: [], catalogSource };
  for (const match of text.matchAll(SKILL_LINK_PATTERN)) {
    addMatch(state, match[1], "");
  }
  return state.entries;
}

function extractSkillBullets(text: string, catalogSource: string): SkillCatalogEntry[] {
  const state: CollectorState = { seen: new Set(), entries: [], catalogSource };
  for (const match of text.matchAll(SKILL_BULLET_PATTERN)) {
    addMatch(state, match[1], match[2].trim());
  }
  return state.entries;
}

export function parseCatalogSkills(layer: PromptLayer): SkillCatalogEntry[] {
  const source = layer.rawContent ?? layer.preview;
  if (!source) return [];

  const linkEntries = extractSkillLinks(source, layer.layerId);
  if (linkEntries.length > 0) return linkEntries;

  return extractSkillBullets(source, layer.layerId);
}
