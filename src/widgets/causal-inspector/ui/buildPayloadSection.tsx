import type { DrawerTab, InspectorCausalSummary } from "../../../entities/run";
import type { InspectorSectionConfig } from "./CausalInspectorSections";
import { PayloadSection } from "./CausalInspectorViews";

export function buildPayloadSection(
  summary: InspectorCausalSummary | null,
  onOpenDrawer: (tab: DrawerTab) => void,
): InspectorSectionConfig {
  return {
    key: "payload",
    title: "Payload",
    content: <PayloadSection summary={summary} onOpenDrawer={onOpenDrawer} />,
  };
}
