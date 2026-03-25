import type { PromptLayer } from "../../run";
import type { SkillCatalogEntry } from "../model/types";

const SKILL_BULLET_WITH_FILE_PATTERN = /^[-*]\s+([^:]+):\s*(.+?)\s*\(file:\s*[^)]+\)\s*$/gm;
const SKILL_BULLET_PATTERN = /^[-*]\s+(\S+):\s*(.+)$/gm;
const SKILL_LINK_PATTERN = /\[([^\]]+)\]\([^)]*SKILL\.md[^)]*\)/g;

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

interface ExtractOptions {
  text: string;
  catalogSource: string;
  pattern: RegExp;
  descIndex: number;
}

function extractWithPattern(opts: ExtractOptions): SkillCatalogEntry[] {
  const state: CollectorState = { seen: new Set(), entries: [], catalogSource: opts.catalogSource };
  for (const match of opts.text.matchAll(opts.pattern)) {
    addMatch(state, match[1], match[opts.descIndex]?.trim() ?? "");
  }
  return state.entries;
}

export function parseCatalogSkills(layer: PromptLayer): SkillCatalogEntry[] {
  const source = layer.rawContent ?? layer.preview;
  if (!source) return [];

  const catalogSource = layer.layerId;
  const withFile = extractWithPattern({ text: source, catalogSource, pattern: SKILL_BULLET_WITH_FILE_PATTERN, descIndex: 2 });
  if (withFile.length > 0) return withFile;

  const bullets = extractWithPattern({ text: source, catalogSource, pattern: SKILL_BULLET_PATTERN, descIndex: 2 });
  if (bullets.length > 0) return bullets;

  return extractWithPattern({ text: source, catalogSource, pattern: SKILL_LINK_PATTERN, descIndex: 0 });
}
