import type { ReactNode } from "react";
import type { DrawerTab, InspectorCausalSummary, SelectionState } from "../../../entities/run";
import { Panel } from "../../../shared/ui";
import "./causal-inspector.css";

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
                <p>{summary.whyBlocked}</p>
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
                  <p className="inspector__affected-count">
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
              <div className="inspector__suggested-action">
                <p>{summary.nextAction}</p>
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
      title="Inspector"
      className={`inspector ${open ? "" : "inspector--closed"} ${compact ? "inspector--compact" : ""}`.trim()}
      actions={
        <button type="button" className="button button--ghost" onClick={onToggleOpen}>
          {open ? "Close" : "Open"}
        </button>
      }
    >
      {!open && compact ? <CompactSummary summary={summary} /> : null}
      {!open && !compact ? (
        <p className="inspector__empty">Inspector closed. Press I to reopen.</p>
      ) : null}
      {open ? (
        <div className="inspector__content">
          {sections.map((section) => (
            <Section key={section.key} title={section.title}>
              {section.content}
            </Section>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

function CompactSummary({ summary }: { summary: InspectorCausalSummary | null }) {
  if (!summary) {
    return <p className="inspector__empty">Select a row to preview the active blocker path.</p>;
  }

  return (
    <div className="inspector__compact-summary">
      <p className="inspector__compact-label">Selection summary</p>
      <strong>{summary.title}</strong>
      <p>{summary.preview}</p>
      <div className="inspector__compact-meta">
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
      <p className="inspector__empty">
        Select a row, edge, or artifact to inspect its causal summary.
      </p>
    );
  }

  return (
    <>
      <h3>{summary.title}</h3>
      <p>{summary.preview}</p>
      <dl className="definition-list">
        {summary.facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd className={fact.emphasis && fact.emphasis !== "default" ? `definition-list__value--${fact.emphasis}` : undefined}>{fact.value}</dd>
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
    return <p className="inspector__empty">No payload preview yet.</p>;
  }

  return (
    <>
      <p>{summary.payloadPreview}</p>
      <span className="inspector__payload-copy">{summary.rawStatusLabel}</span>
      <div className="inspector__payload-actions">
        {PAYLOAD_ACTIONS.map((action) => (
          <button
            key={action.tab}
            type="button"
            className="button button--ghost"
            onClick={() => onOpenDrawer(action.tab)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </>
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
    <button type="button" className="inspector-jump" onClick={onClick}>
      <strong>{label}</strong>
      <span>{description}</span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="inspector-section">
      <header className="inspector-section__header">
        <h3>{title}</h3>
      </header>
      <div className="inspector-section__body">{children}</div>
    </section>
  );
}
