import type { InspectorCausalSummary, SelectionState } from "../../../entities/run";
import type { InspectorSectionConfig } from "./CausalInspectorSections";
import { JumpButton } from "./CausalInspectorViews";

export function buildDirectCauseSection(
  summary: InspectorCausalSummary,
  onSelectJump: (selection: SelectionState) => void,
) {
  const firstUpstream = summary.upstream[0] ?? null;
  if (!summary.whyBlocked) {
    return null;
  }

  return {
    key: "direct-cause",
    title: "Direct cause",
    content: (
      <>
        <p className="text-[0.8rem] leading-6 text-muted-foreground">{summary.whyBlocked}</p>
        {firstUpstream ? (
          <JumpButton
            label={firstUpstream.label}
            description={firstUpstream.description}
            onClick={() => onSelectJump(firstUpstream.selection)}
          />
        ) : null}
      </>
    ),
  } satisfies InspectorSectionConfig;
}
