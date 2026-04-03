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
  sessionReview?: ReactNode;
}

export function buildInspectorSections({
  summary,
  onSelectJump,
  onOpenDrawer,
  sessionReview,
}: BuildInspectorSectionsOptions) {
  const sections = [];
  sections.push(buildSummarySection(summary));

  if (sessionReview) {
    sections.push({
      key: "session-review",
      title: "Session review",
      content: sessionReview,
    } satisfies InspectorSectionConfig);
  }

  if (!summary) {
    sections.push(buildPayloadSection(summary, onOpenDrawer));
    return sections;
  }

  return [
    ...sections,
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
