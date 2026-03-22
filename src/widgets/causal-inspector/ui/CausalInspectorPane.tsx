import type { ReactNode } from "react";
import type { DrawerTab, InspectorCausalSummary, SelectionState } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { Panel } from "../../../shared/ui";
import { Button, ScrollArea, Separator } from "../../../shared/ui/primitives";

const PAYLOAD_ACTIONS: Array<{ tab: DrawerTab; label: string }> = [
  { tab: "artifacts", label: "Artifacts" },
  { tab: "context", label: "Context" },
  { tab: "log", label: "Log" },
  { tab: "raw", label: "Raw" },
];

interface InspectorSectionConfig {
  key: string;
  title: string;
  content: ReactNode;
}

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
  const sections: InspectorSectionConfig[] = [
    {
      key: "summary",
      title: "Summary",
      content: <SummarySection summary={summary} />,
    },
    ...(summary?.whyBlocked
      ? [
          {
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
          },
        ]
      : []),
    ...(summary?.upstream.length
      ? [
          {
            key: "upstream-chain",
            title: "Upstream chain",
            content: (
              <>
                {summary.upstream.map((item) => (
                  <JumpButton
                    key={`${item.label}:${item.selection.id}`}
                    label={item.label}
                    description={item.description}
                    onClick={() => onSelectJump(item.selection)}
                  />
                ))}
              </>
            ),
          },
        ]
      : []),
    ...(summary?.downstream.length
      ? [
          {
            key: "downstream-impact",
            title: "Downstream impact",
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
                {summary.downstream.map((item) => (
                  <JumpButton
                    key={`${item.label}:${item.selection.id}`}
                    label={item.label}
                    description={item.description}
                    onClick={() => onSelectJump(item.selection)}
                  />
                ))}
              </>
            ),
          },
        ]
      : []),
    ...(summary?.nextAction
      ? [
          {
            key: "suggested-next",
            title: "Suggested next",
            content: (
              <div className="rounded-r-md border-l-2 border-[var(--color-active)] bg-[color:color-mix(in_srgb,var(--color-active)_6%,transparent)] px-3 py-2">
                <p className="text-[0.8rem] leading-6 text-muted-foreground">{summary.nextAction}</p>
              </div>
            ),
          },
        ]
      : []),
    {
      key: "payload",
      title: "Payload",
      content: <PayloadSection summary={summary} onOpenDrawer={onOpenDrawer} />,
    },
  ];

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
      {!open && compact ? <CompactSummary summary={summary} /> : null}
      {!open && !compact ? (
        <p className="text-sm text-muted-foreground">Inspector closed. Press I to reopen.</p>
      ) : null}
      {open ? (
        <ScrollArea className="min-h-0 flex-1">
          <div className="grid gap-3 pr-3">
            {sections.map((section) => (
              <Section key={section.key} title={section.title}>
                {section.content}
              </Section>
            ))}
          </div>
        </ScrollArea>
      ) : null}
    </Panel>
  );
}

function CompactSummary({ summary }: { summary: InspectorCausalSummary | null }) {
  if (!summary) {
    return <p className="text-sm text-muted-foreground">Select a row to preview the active blocker path.</p>;
  }

  return (
    <div className="grid gap-2">
      <p className="text-[0.78rem] text-muted-foreground">Selection summary</p>
      <strong className="text-sm font-semibold">{summary.title}</strong>
      <p className="text-sm text-muted-foreground">{summary.preview}</p>
      <div className="flex flex-wrap gap-2 text-[0.78rem] text-muted-foreground">
        {summary.facts.slice(0, 3).map((fact) => (
          <span key={fact.label}>{fact.value}</span>
        ))}
      </div>
    </div>
  );
}

function SummarySection({ summary }: { summary: InspectorCausalSummary | null }) {
  if (!summary) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a row, edge, or artifact to inspect its causal summary.
      </p>
    );
  }

  return (
    <>
      <h3 className="text-[0.95rem] font-semibold leading-5">{summary.title}</h3>
      <p className="text-[0.8rem] leading-6 text-muted-foreground">{summary.preview}</p>
      <Separator className="bg-white/8" />
      <dl className="grid gap-2">
        {summary.facts.map((fact) => (
          <div
            key={fact.label}
            className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2"
          >
            <dt className="text-[0.78rem] font-medium text-muted-foreground">{fact.label}</dt>
            <dd
              className={cn(
                "m-0 rounded px-2 py-1 text-[0.78rem] tabular-nums",
                "bg-white/[0.07]",
                fact.emphasis === "danger" && "text-[var(--color-failed)]",
                fact.emphasis === "warning" && "text-[var(--color-waiting)]",
                fact.emphasis === "accent" && "text-[var(--color-active)]",
              )}
            >
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function PayloadSection({
  summary,
  onOpenDrawer,
}: {
  summary: InspectorCausalSummary | null;
  onOpenDrawer: (tab: DrawerTab) => void;
}) {
  if (!summary) {
    return <p className="text-sm text-muted-foreground">No payload preview yet.</p>;
  }

  return (
    <div className="grid gap-3">
      <p className="text-[0.8rem] leading-6 text-muted-foreground">{summary.payloadPreview}</p>
      <span className="text-[0.82rem] text-muted-foreground">{summary.rawStatusLabel}</span>
      <div className="flex flex-wrap gap-2">
        {PAYLOAD_ACTIONS.map((action) => (
          <Button
            key={action.tab}
            type="button"
            variant="outline"
            size="xs"
            className="border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.06]"
            onClick={() => onOpenDrawer(action.tab)}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function JumpButton({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="grid gap-1 rounded-[10px] border border-white/8 bg-white/[0.02] px-3 py-2 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-active)]/45"
      onClick={onClick}
    >
      <strong className="text-sm font-semibold">{label}</strong>
      <span className="text-[0.78rem] text-muted-foreground">{description}</span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2 rounded-[10px] border border-white/8 bg-white/[0.025] px-3 py-3">
      <header>
        <h3 className="text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
          {title}
        </h3>
      </header>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}
