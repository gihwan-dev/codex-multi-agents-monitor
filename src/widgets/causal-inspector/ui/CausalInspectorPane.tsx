import type { DrawerTab, InspectorCausalSummary, SelectionState } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { Panel } from "../../../shared/ui";
import { Button, ScrollArea } from "../../../shared/ui/primitives";
import { CausalInspectorCompactSummary } from "./CausalInspectorCompactSummary";
import { CausalInspectorJumpButton } from "./CausalInspectorJumpButton";
import { CausalInspectorPayloadSection } from "./CausalInspectorPayloadSection";
import { CausalInspectorSection } from "./CausalInspectorSection";
import { CausalInspectorSummarySection } from "./CausalInspectorSummarySection";

interface CausalInspectorPaneProps {
  summary: InspectorCausalSummary | null;
  onSelectJump: (selection: SelectionState) => void;
  onOpenDrawer: (tab: DrawerTab) => void;
  onToggleOpen: () => void;
  open: boolean;
  compact?: boolean;
}

export function CausalInspectorPane({
  summary,
  onSelectJump,
  onOpenDrawer,
  onToggleOpen,
  open,
  compact = false,
}: CausalInspectorPaneProps) {
  const firstUpstream = summary?.upstream[0] ?? null;

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
      {!open && compact ? <CausalInspectorCompactSummary summary={summary} /> : null}
      {!open && !compact ? (
        <p className="text-sm text-muted-foreground">Inspector closed. Press I to reopen.</p>
      ) : null}
      {open ? (
        <ScrollArea className="min-h-0 flex-1">
          <div className="grid gap-3 pr-3">
            <CausalInspectorSection title="Summary">
              <CausalInspectorSummarySection summary={summary} />
            </CausalInspectorSection>

            {summary?.whyBlocked ? (
              <CausalInspectorSection title="Direct cause">
                <p className="text-[0.8rem] leading-6 text-muted-foreground">{summary.whyBlocked}</p>
                {firstUpstream ? (
                  <CausalInspectorJumpButton
                    label={firstUpstream.label}
                    description={firstUpstream.description}
                    onClick={() => onSelectJump(firstUpstream.selection)}
                  />
                ) : null}
              </CausalInspectorSection>
            ) : null}

            {summary?.upstream.length ? (
              <CausalInspectorSection title="Upstream chain">
                {summary.upstream.map((item) => (
                  <CausalInspectorJumpButton
                    key={`${item.label}:${item.selection.id}`}
                    label={item.label}
                    description={item.description}
                    onClick={() => onSelectJump(item.selection)}
                  />
                ))}
              </CausalInspectorSection>
            ) : null}

            {summary?.downstream.length ? (
              <CausalInspectorSection title="Downstream impact">
                {summary.affectedAgentCount ? (
                  <p className="text-[0.82rem] font-medium text-[var(--color-active)]">
                    {summary.affectedAgentCount} agent
                    {summary.affectedAgentCount !== 1 ? "s" : ""} affected
                    {summary.downstreamWaitingCount
                      ? ` · ${summary.downstreamWaitingCount} waiting`
                      : ""}
                  </p>
                ) : null}
                {summary.downstream.map((item) => (
                  <CausalInspectorJumpButton
                    key={`${item.label}:${item.selection.id}`}
                    label={item.label}
                    description={item.description}
                    onClick={() => onSelectJump(item.selection)}
                  />
                ))}
              </CausalInspectorSection>
            ) : null}

            {summary?.nextAction ? (
              <CausalInspectorSection title="Suggested next">
                <div className="rounded-r-md border-l-2 border-[var(--color-active)] bg-[color:color-mix(in_srgb,var(--color-active)_6%,transparent)] px-3 py-2">
                  <p className="text-[0.8rem] leading-6 text-muted-foreground">{summary.nextAction}</p>
                </div>
              </CausalInspectorSection>
            ) : null}

            <CausalInspectorSection title="Payload">
              <CausalInspectorPayloadSection
                summary={summary}
                onOpenDrawer={onOpenDrawer}
              />
            </CausalInspectorSection>
          </div>
        </ScrollArea>
      ) : null}
    </Panel>
  );
}
