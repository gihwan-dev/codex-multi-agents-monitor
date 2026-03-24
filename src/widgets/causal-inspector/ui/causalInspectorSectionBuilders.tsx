import type { DrawerTab, InspectorCausalSummary, SelectionState } from "../../../entities/run";
import {
  JumpButton,
  PayloadSection,
  SummarySection,
} from "./CausalInspectorViews";
import type { InspectorSectionConfig } from "./CausalInspectorSections";

export function buildSummarySection(
  summary: InspectorCausalSummary | null,
): InspectorSectionConfig {
  return {
    key: "summary",
    title: "Summary",
    content: <SummarySection summary={summary} />,
  };
}

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

export function buildJumpSection({
  key,
  title,
  items,
  onSelectJump,
}: {
  key: string;
  title: string;
  items: InspectorCausalSummary["upstream"];
  onSelectJump: (selection: SelectionState) => void;
}) {
  if (!items.length) {
    return null;
  }

  return {
    key,
    title,
    content: (
      <>
        {items.map((item) => (
          <JumpButton
            key={`${item.label}:${item.selection.id}`}
            label={item.label}
            description={item.description}
            onClick={() => onSelectJump(item.selection)}
          />
        ))}
      </>
    ),
  } satisfies InspectorSectionConfig;
}

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
