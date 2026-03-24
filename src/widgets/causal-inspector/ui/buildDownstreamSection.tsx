import type { InspectorCausalSummary, SelectionState } from "../../../entities/run";
import { buildJumpSection } from "./buildJumpSection";
import type { InspectorSectionConfig } from "./CausalInspectorSections";

export function buildDownstreamSection(
  summary: InspectorCausalSummary,
  onSelectJump: (selection: SelectionState) => void,
) {
  const jumpSection = buildJumpSection({
    key: "downstream-impact",
    title: "Downstream impact",
    items: summary.downstream,
    onSelectJump,
  });
  if (!jumpSection) {
    return null;
  }

  return {
    ...jumpSection,
    content: (
      <>
        {summary.affectedAgentCount ? (
          <p className="text-[0.82rem] font-medium text-[var(--color-active)]">
            {summary.affectedAgentCount} agent
            {summary.affectedAgentCount !== 1 ? "s" : ""} affected
            {summary.downstreamWaitingCount
              ? ` · ${summary.downstreamWaitingCount} waiting`
              : ""}
          </p>
        ) : null}
        {jumpSection.content}
      </>
    ),
  } satisfies InspectorSectionConfig;
}
