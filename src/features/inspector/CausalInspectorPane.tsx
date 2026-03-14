import type { ReactNode } from "react";
import {
  type ArtifactRecord,
  type DrawerTab,
  type EdgeRecord,
  type EventRecord,
  formatCurrency,
  formatDuration,
  formatTimestamp,
  type RunDataset,
  type SelectionState,
  truncateId,
} from "../../shared/domain";
import { Panel } from "../../shared/ui";

interface CausalInspectorPaneProps {
  dataset: RunDataset;
  selection: EventRecord | EdgeRecord | ArtifactRecord | null;
  rawEnabled: boolean;
  onSelectJump: (selection: SelectionState) => void;
  onOpenDrawer: (tab: DrawerTab) => void;
  onToggleOpen: () => void;
  onTogglePinned: () => void;
  pinned: boolean;
  open: boolean;
  compact?: boolean;
}

export function CausalInspectorPane({
  dataset,
  selection,
  rawEnabled,
  onSelectJump,
  onOpenDrawer,
  onToggleOpen,
  onTogglePinned,
  pinned,
  open,
  compact = false,
}: CausalInspectorPaneProps) {
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
      {!open && compact ? <CompactSummary selection={selection} rawEnabled={rawEnabled} /> : null}
      {!open && !compact ? <p className="inspector__empty">Inspector closed. Press I to reopen.</p> : null}
      {open ? (
        <div className="inspector__content">
          <Section title="Summary">
            <Summary selection={selection} rawEnabled={rawEnabled} />
          </Section>
          <Section title="Cause">
            {buildCause(dataset, selection).map((item) => (
              <button
                key={`${item.label}:${item.selection.id}`}
                type="button"
                className="inspector-jump"
                onClick={() => onSelectJump(item.selection)}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </Section>
          <Section title="Impact">
            {buildImpact(dataset, selection).map((item) => (
              <button
                key={`${item.label}:${item.selection.id}`}
                type="button"
                className="inspector-jump"
                onClick={() => onSelectJump(item.selection)}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </Section>
          <Section title="Payload">
            <Payload selection={selection} rawEnabled={rawEnabled} onOpenDrawer={onOpenDrawer} />
          </Section>
        </div>
      ) : null}
    </Panel>
  );
}

function CompactSummary({
  selection,
  rawEnabled,
}: {
  selection: EventRecord | EdgeRecord | ArtifactRecord | null;
  rawEnabled: boolean;
}) {
  const summary = summarizeSelection(selection, rawEnabled);

  if (!summary) {
    return <p className="inspector__empty">Select a row to preview the current cause chain.</p>;
  }

  return (
    <div className="inspector__compact-summary">
      <p className="inspector__compact-label">Selection summary</p>
      <strong>{summary.title}</strong>
      <p>{summary.preview}</p>
      <div className="inspector__compact-meta">
        {summary.meta.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  );
}

function Summary({
  selection,
  rawEnabled,
}: {
  selection: EventRecord | EdgeRecord | ArtifactRecord | null;
  rawEnabled: boolean;
}) {
  if (!selection) {
    return <p className="inspector__empty">Select a row, edge, or artifact to inspect its cause and impact.</p>;
  }
  if ("eventId" in selection) {
    return (
      <>
        <h3>{selection.title}</h3>
        <p>{selection.outputPreview ?? selection.inputPreview ?? "n/a"}</p>
        <dl className="definition-list">
          <div><dt>Status</dt><dd>{selection.status}</dd></div>
          <div><dt>Started</dt><dd>{formatTimestamp(selection.startTs)}</dd></div>
          <div><dt>Duration</dt><dd>{formatDuration(selection.durationMs)}</dd></div>
          <div><dt>wait_reason</dt><dd>{selection.waitReason ?? "reason unavailable"}</dd></div>
          <div><dt>Cost</dt><dd>{formatCurrency(selection.costUsd)}</dd></div>
        </dl>
      </>
    );
  }
  if ("edgeId" in selection) {
    return (
      <>
        <h3>{selection.edgeType}</h3>
        <p>{selection.payloadPreview ?? "n/a"}</p>
        <dl className="definition-list">
          <div><dt>Source</dt><dd>{truncateId(selection.sourceEventId)}</dd></div>
          <div><dt>Target</dt><dd>{truncateId(selection.targetEventId)}</dd></div>
          <div><dt>Artifact</dt><dd>{selection.artifactId ? truncateId(selection.artifactId) : "n/a"}</dd></div>
        </dl>
      </>
    );
  }
  return (
    <>
      <h3>{selection.title}</h3>
      <p>{selection.preview}</p>
      <dl className="definition-list">
        <div><dt>Artifact</dt><dd>{truncateId(selection.artifactId)}</dd></div>
        <div><dt>Producer</dt><dd>{truncateId(selection.producerEventId)}</dd></div>
        <div><dt>Raw</dt><dd>{rawEnabled && selection.rawContent ? "available" : "redacted"}</dd></div>
      </dl>
    </>
  );
}

function Payload({
  selection,
  rawEnabled,
  onOpenDrawer,
}: {
  selection: EventRecord | EdgeRecord | ArtifactRecord | null;
  rawEnabled: boolean;
  onOpenDrawer: (tab: DrawerTab) => void;
}) {
  if (!selection) {
    return <p className="inspector__empty">No payload preview yet.</p>;
  }
  const preview =
    "eventId" in selection
      ? selection.outputPreview ?? selection.inputPreview ?? "n/a"
      : "edgeId" in selection
        ? selection.payloadPreview ?? "n/a"
        : selection.preview;
  return (
    <>
      <p>{preview}</p>
      <span className="inspector__payload-copy">
        {rawEnabled ? "Raw detail is available in the drawer." : "Raw detail remains gated until opt-in."}
      </span>
      <div className="inspector__payload-actions">
        <button type="button" className="button button--ghost" onClick={() => onOpenDrawer("artifacts")}>Artifacts</button>
        <button type="button" className="button button--ghost" onClick={() => onOpenDrawer("log")}>Log</button>
        <button type="button" className="button button--ghost" onClick={() => onOpenDrawer("raw")}>Raw</button>
      </div>
    </>
  );
}

function summarizeSelection(
  selection: EventRecord | EdgeRecord | ArtifactRecord | null,
  rawEnabled: boolean,
) {
  if (!selection) {
    return null;
  }

  if ("eventId" in selection) {
    return {
      title: selection.title,
      preview: selection.outputPreview ?? selection.inputPreview ?? "n/a",
      meta: [
        selection.status,
        formatDuration(selection.durationMs),
        selection.waitReason ?? "reason unavailable",
      ],
    };
  }

  if ("edgeId" in selection) {
    return {
      title: selection.edgeType,
      preview: selection.payloadPreview ?? "n/a",
      meta: [
        `from ${truncateId(selection.sourceEventId)}`,
        `to ${truncateId(selection.targetEventId)}`,
        selection.artifactId ? `artifact ${truncateId(selection.artifactId)}` : "no artifact",
      ],
    };
  }

  return {
    title: selection.title,
    preview: selection.preview,
    meta: [
      `artifact ${truncateId(selection.artifactId)}`,
      `producer ${truncateId(selection.producerEventId)}`,
      rawEnabled && selection.rawContent ? "raw available" : "raw redacted",
    ],
  };
}

function buildCause(dataset: RunDataset, selection: EventRecord | EdgeRecord | ArtifactRecord | null) {
  if (!selection) return [];
  if ("eventId" in selection) {
    return [
      ...(selection.parentId
        ? [{ label: "Parent event", description: "Jump to the event that directly led here.", selection: { kind: "event" as const, id: selection.parentId } }]
        : []),
      ...dataset.edges
        .filter((edge) => edge.targetEventId === selection.eventId)
        .map((edge) => ({
          label: `${edge.edgeType} source`,
          description: edge.payloadPreview ?? "Jump to the upstream edge source.",
          selection: { kind: "event" as const, id: edge.sourceEventId },
        })),
    ];
  }
  if ("edgeId" in selection) {
    return [{ label: "Source event", description: "Jump to the upstream event.", selection: { kind: "event" as const, id: selection.sourceEventId } }];
  }
  return [{ label: "Producer event", description: "Jump to the event that created this artifact.", selection: { kind: "event" as const, id: selection.producerEventId } }];
}

function buildImpact(dataset: RunDataset, selection: EventRecord | EdgeRecord | ArtifactRecord | null) {
  if (!selection) return [];
  if ("eventId" in selection) {
    return [
      ...dataset.events
        .filter((event) => event.parentId === selection.eventId)
        .map((event) => ({
          label: event.title,
          description: event.outputPreview ?? event.inputPreview ?? "Jump to the downstream event.",
          selection: { kind: "event" as const, id: event.eventId },
        })),
      ...dataset.edges
        .filter((edge) => edge.sourceEventId === selection.eventId)
        .map((edge) => ({
          label: `${edge.edgeType} target`,
          description: edge.payloadPreview ?? "Jump to the downstream event.",
          selection: { kind: "event" as const, id: edge.targetEventId },
        })),
    ];
  }
  if ("edgeId" in selection) {
    return [{ label: "Target event", description: "Jump to the downstream event.", selection: { kind: "event" as const, id: selection.targetEventId } }];
  }
  return [];
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
