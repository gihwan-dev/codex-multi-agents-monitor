import type { InspectorCausalSummary } from "../../../entities/run";
import type { InspectorSectionConfig } from "./CausalInspectorSections";
import { SummarySection } from "./CausalInspectorViews";

export function buildSummarySection(
  summary: InspectorCausalSummary | null,
): InspectorSectionConfig {
  return {
    key: "summary",
    title: "Summary",
    content: <SummarySection summary={summary} />,
  };
}
