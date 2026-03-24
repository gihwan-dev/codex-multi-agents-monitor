import type { ReactNode } from "react";
import type { DrawerTab, InspectorCausalSummary, SelectionState } from "../../../entities/run";
import {
  buildDirectCauseSection,
  buildDownstreamSection,
  buildJumpSection,
  buildNextActionSection,
  buildPayloadSection,
  buildSummarySection,
} from "./causalInspectorSectionBuilders";

export interface InspectorSectionConfig {
  key: string;
  title: string;
  content: ReactNode;
}

interface BuildInspectorSectionsOptions {
  summary: InspectorCausalSummary | null;
  onSelectJump: (selection: SelectionState) => void;
  onOpenDrawer: (tab: DrawerTab) => void;
}

export function buildInspectorSections({
  summary,
  onSelectJump,
  onOpenDrawer,
}: BuildInspectorSectionsOptions) {
  if (!summary) {
    return [buildSummarySection(summary), buildPayloadSection(summary, onOpenDrawer)];
  }

  return [
    buildSummarySection(summary),
    buildDirectCauseSection(summary, onSelectJump),
    buildJumpSection({
      key: "upstream-chain",
      title: "Upstream chain",
      items: summary.upstream,
      onSelectJump,
    }),
    buildDownstreamSection(summary, onSelectJump),
    buildNextActionSection(summary),
    buildPayloadSection(summary, onOpenDrawer),
  ].filter((section): section is InspectorSectionConfig => section !== null);
}
