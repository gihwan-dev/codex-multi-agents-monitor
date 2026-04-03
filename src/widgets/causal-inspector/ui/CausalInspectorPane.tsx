import type { DrawerTab, InspectorCausalSummary, SelectionState } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { Panel } from "../../../shared/ui";
import {
  buildInspectorSections,
} from "./CausalInspectorSections";
import { InspectorSections } from "./CausalInspectorViews";

interface CausalInspectorPaneProps {
  summary: InspectorCausalSummary | null;
  onSelectJump: (selection: SelectionState) => void;
  onOpenDrawer: (tab: DrawerTab) => void;
  compact?: boolean;
}

export function CausalInspectorPane({
  summary,
  onSelectJump,
  onOpenDrawer,
  compact = false,
}: CausalInspectorPaneProps) {
  const motionKey = summary
    ? `${summary.title}:${summary.rawStatusLabel}:${summary.preview}`
    : "inspector-empty";
  const sections = buildInspectorSections({
    summary,
    onSelectJump,
    onOpenDrawer,
  });

  return (
    <Panel
      panelSlot={compact ? "compact-inspector" : "inspector-pane"}
      title="Inspector"
      className={cn(
        "flex h-full flex-1",
        compact
          ? "rounded-[var(--radius-panel)] border"
          : "rounded-none border-l-0 max-[1180px]:rounded-[var(--radius-panel)] max-[1180px]:border",
      )}
    >
      <InspectorSections motionKey={motionKey} sections={sections} />
    </Panel>
  );
}
