import type { PromptLayerType } from "../../../entities/run";

export const DYNAMIC_LAYER_TYPES: ReadonlySet<PromptLayerType> = new Set([
  "user",
  "agents",
  "collaboration-mode",
  "skills-catalog",
  "automation",
  "delegated",
]);

export const LAYER_ACCENTS: Record<PromptLayerType, string> = {
  system: "var(--color-text-tertiary)",
  permissions: "var(--color-text-tertiary)",
  "app-context": "var(--color-text-tertiary)",
  "collaboration-mode": "var(--color-waiting)",
  apps: "var(--color-text-secondary)",
  "skills-catalog": "var(--color-transfer)",
  agents: "var(--color-handoff)",
  environment: "var(--color-text-tertiary)",
  automation: "var(--color-waiting)",
  delegated: "var(--color-stale)",
  user: "var(--color-active)",
  skill: "var(--color-transfer)",
  "subagent-notification": "var(--color-stale)",
};

export function buildLayerStyle(accent: string) {
  return {
    borderLeftColor: accent,
    borderLeftWidth: "3px",
    backgroundColor: `color-mix(in srgb, ${accent} 4%, var(--color-prompt-layer-mix-base))`,
  };
}
