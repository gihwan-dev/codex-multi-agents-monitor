import type { DrawerTab, InspectorCausalSummary, SelectionState } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { Panel } from "../../../shared/ui";
import { Button } from "../../../shared/ui/primitives";
import {
  buildInspectorSections,
} from "./CausalInspectorSections";
import { CompactSummary, InspectorSections } from "./CausalInspectorViews";

interface CausalInspectorPaneProps {
  summary: InspectorCausalSummary | null;
  onSelectJump: (selection: SelectionState) => void;
  onOpenDrawer: (tab: DrawerTab) => void;
  onToggleOpen: () => void;
  open: boolean;
  compact?: boolean;
}

function ClosedInspectorContent({
  compact,
  summary,
}: Pick<CausalInspectorPaneProps, "compact" | "summary">) {
  if (compact) {
    return <CompactSummary summary={summary} />;
  }

  return <p className="text-sm text-muted-foreground">Inspector closed. Press I to reopen.</p>;
}

export function CausalInspectorPane({
  summary,
  onSelectJump,
  onOpenDrawer,
  onToggleOpen,
  open,
  compact = false,
}: CausalInspectorPaneProps) {
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
        !open && "opacity-90",
      )}
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.06]"
          onClick={onToggleOpen}
        >
          {open ? "Close" : "Open"}
        </Button>
      }
    >
      {open ? (
        <InspectorSections sections={sections} />
      ) : (
        <ClosedInspectorContent compact={compact} summary={summary} />
      )}
    </Panel>
  );
}
