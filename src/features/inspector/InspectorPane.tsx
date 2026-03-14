import { type ArtifactRecord, type EdgeRecord, type EventRecord, formatCurrency, formatDuration, formatTimestamp, type InspectorTab, truncateId } from "../../shared/domain";
import { InspectorTabs, Panel } from "../../shared/ui";

interface InspectorPaneProps {
  selection: EventRecord | EdgeRecord | ArtifactRecord | null;
  activeTab: InspectorTab;
  rawEnabled: boolean;
  showRawTab: boolean;
  onChangeTab: (tab: InspectorTab) => void;
  onTogglePinned: () => void;
  pinned: boolean;
  open: boolean;
}

export function InspectorPane({
  selection,
  activeTab,
  rawEnabled,
  showRawTab,
  onChangeTab,
  onTogglePinned,
  pinned,
  open,
}: InspectorPaneProps) {
  return (
    <Panel
      title="Inspector"
      className={`inspector ${open ? "" : "inspector--closed"}`.trim()}
      actions={
        <button type="button" className="button button--ghost" onClick={onTogglePinned}>
          {pinned ? "Pinned" : "Pin"}
        </button>
      }
    >
      <InspectorTabs
        activeTab={activeTab}
        onChange={onChangeTab}
        rawEnabled={rawEnabled}
        showRawTab={showRawTab}
      />
      {!open ? <p className="inspector__empty">Inspector closed. Press I to reopen.</p> : null}
      {open ? <InspectorContent selection={selection} activeTab={activeTab} rawEnabled={rawEnabled} /> : null}
    </Panel>
  );
}

function InspectorContent({
  selection,
  activeTab,
  rawEnabled,
}: {
  selection: EventRecord | EdgeRecord | ArtifactRecord | null;
  activeTab: InspectorTab;
  rawEnabled: boolean;
}) {
  if (!selection) {
    return <p className="inspector__empty">Select an event, edge, or artifact to inspect.</p>;
  }

  if ("eventId" in selection) {
    return (
      <div className="inspector__content">
        {activeTab === "summary" ? (
          <>
            <h3>{selection.title}</h3>
            <p>{selection.outputPreview ?? selection.inputPreview ?? "n/a"}</p>
            <dl className="definition-list">
              <div>
                <dt>Status</dt>
                <dd>{selection.status}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>{formatTimestamp(selection.startTs)}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{formatDuration(selection.durationMs)}</dd>
              </div>
              <div>
                <dt>wait_reason</dt>
                <dd>{selection.waitReason ?? "reason unavailable"}</dd>
              </div>
              <div>
                <dt>Cost</dt>
                <dd>{formatCurrency(selection.costUsd)}</dd>
              </div>
            </dl>
          </>
        ) : null}
        {activeTab === "input" ? <pre className="inspector__pre">{selection.inputPreview ?? "n/a"}</pre> : null}
        {activeTab === "output" ? <pre className="inspector__pre">{selection.outputPreview ?? "n/a"}</pre> : null}
        {activeTab === "trace" ? (
          <pre className="inspector__pre">
            {JSON.stringify(
              {
                eventId: truncateId(selection.eventId),
                parentId: selection.parentId,
                linkIds: selection.linkIds,
                provider: selection.provider,
                model: selection.model,
                toolName: selection.toolName,
                finishReason: selection.finishReason,
              },
              null,
              2,
            )}
          </pre>
        ) : null}
        {activeTab === "raw" ? (
          <pre className="inspector__pre">
            {rawEnabled ? selection.rawOutput ?? selection.rawInput ?? "redacted" : "Raw tab hidden until raw opt-in is enabled."}
          </pre>
        ) : null}
      </div>
    );
  }

  if ("edgeId" in selection) {
    return (
      <div className="inspector__content">
        <h3>{selection.edgeType}</h3>
        <pre className="inspector__pre">{JSON.stringify(selection, null, 2)}</pre>
      </div>
    );
  }

  return (
    <div className="inspector__content">
      <h3>{selection.title}</h3>
      <pre className="inspector__pre">
        {activeTab === "raw"
          ? rawEnabled
            ? selection.rawContent ?? "redacted"
            : "Raw tab hidden until raw opt-in is enabled."
          : selection.preview}
      </pre>
    </div>
  );
}
