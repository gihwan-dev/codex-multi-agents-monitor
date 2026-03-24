import type { InspectorCausalSummary } from "../../../entities/run";
import type { InspectorSectionConfig } from "./CausalInspectorSections";

export function buildNextActionSection(summary: InspectorCausalSummary) {
  if (!summary.nextAction) {
    return null;
  }

  return {
    key: "suggested-next",
    title: "Suggested next",
    content: (
      <div className="rounded-r-md border-l-2 border-[var(--color-active)] bg-[color:color-mix(in_srgb,var(--color-active)_6%,transparent)] px-3 py-2">
        <p className="text-[0.8rem] leading-6 text-muted-foreground">{summary.nextAction}</p>
      </div>
    ),
  } satisfies InspectorSectionConfig;
}
