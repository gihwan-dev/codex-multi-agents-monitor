import type { ReactNode } from "react";
import type { DrawerTab, InspectorCausalSummary, SelectionState } from "../../shared/domain";
import { Panel } from "../../shared/ui";

interface CausalInspectorPaneProps {
  summary: InspectorCausalSummary | null;
  onSelectJump: (selection: SelectionState) => void;
  onOpenDrawer: (tab: DrawerTab) => void;
  onToggleOpen: () => void;
  onTogglePinned: () => void;
  pinned: boolean;
  open: boolean;
  compact?: boolean;
}

export function CausalInspectorPane({
  summary,
  onSelectJump,
  onOpenDrawer,
  onToggleOpen,
  onTogglePinned,
  pinned,
  open,
  compact = false,
}: CausalInspectorPaneProps) {
  const showDirectCause = Boolean(summary?.whyBlocked);
  const showUpstream = Boolean(summary?.upstream.length);
  const showDownstream = Boolean(summary?.downstream.length);
  const showSuggestedNext = Boolean(summary?.nextAction);

  return (
    <Panel
      title="Inspector"
      className={`inspector ${open ? "" : "inspector--closed"} ${compact ? "inspector--compact" : ""}`.trim()}
      actions={
        compact ? (
          <button type="button" className="button button--ghost" onClick={onToggleOpen}>
            {open ? "Close" : "Open"}
          </button>
        ) : (
          <button type="button" className="button button--ghost" onClick={onTogglePinned}>
            {pinned ? "Pinned" : "Pin"}
          </button>
        )
      }
    >
      {!open && compact ? <CompactSummary summary={summary} /> : null}
      {!open && !compact ? (
        <p className="inspector__empty">Inspector closed. Press I to reopen.</p>
      ) : null}
      {open ? (
        <div className="inspector__content">
          <Section title="Summary">
            <SummarySection summary={summary} />
          </Section>
          {showDirectCause ? (
            <Section title="Direct cause">
              <p>{summary?.whyBlocked}</p>
              {summary?.upstream[0] ? (
                <JumpButton
                  label={summary.upstream[0].label}
                  description={summary.upstream[0].description}
                  onClick={() => onSelectJump(summary.upstream[0].selection)}
                />
              ) : null}
            </Section>
          ) : null}
          {showUpstream ? (
            <Section title="Upstream chain">
              {summary?.upstream.map((item) => (
                <JumpButton
                  key={`${item.label}:${item.selection.id}`}
                  label={item.label}
                  description={item.description}
                  onClick={() => onSelectJump(item.selection)}
                />
              ))}
            </Section>
          ) : null}
          {showDownstream ? (
            <Section title="Downstream impact">
              {summary?.affectedAgentCount ? (
                <p className="inspector__affected-count">
                  {summary.affectedAgentCount} agent{summary.affectedAgentCount !== 1 ? "s" : ""} affected
                  {summary.downstreamWaitingCount
                    ? ` · ${summary.downstreamWaitingCount} waiting`
                    : ""}
                </p>
              ) : null}
              {summary?.downstream.map((item) => (
                <JumpButton
                  key={`${item.label}:${item.selection.id}`}
                  label={item.label}
                  description={item.description}
                  onClick={() => onSelectJump(item.selection)}
                />
              ))}
            </Section>
          ) : null}
          {showSuggestedNext ? (
            <Section title="Suggested next">
              <div className="inspector__suggested-action">
                <p>{summary?.nextAction}</p>
              </div>
            </Section>
          ) : null}
          <Section title="Payload">
            <PayloadSection summary={summary} onOpenDrawer={onOpenDrawer} />
          </Section>
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
            <dd>{fact.value}</dd>
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
        <button type="button" className="button button--ghost" onClick={() => onOpenDrawer("artifacts")}>
          Artifacts
        </button>
        <button type="button" className="button button--ghost" onClick={() => onOpenDrawer("log")}>
          Log
        </button>
        <button type="button" className="button button--ghost" onClick={() => onOpenDrawer("raw")}>
          Raw
        </button>
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
