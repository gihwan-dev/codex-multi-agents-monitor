import { PromptAssemblyView } from "../../features/inspector/PromptAssemblyView";
import {
  DRAWER_TABS,
  type DrawerTab,
  formatCurrency,
  formatTokens,
  type RunDataset,
} from "../../shared/domain";
import { Panel } from "../../shared/ui";
import type { MonitorState } from "../monitorState";

interface MonitorDrawerProps {
  state: MonitorState;
  activeDataset: RunDataset;
  rawTabAvailable: boolean;
  onSetDrawerTab: (tab: DrawerTab, target?: HTMLElement | null) => void;
  onImport: () => void;
  onImportTextChange: (value: string) => void;
  onAllowRawChange: (value: boolean) => void;
  onNoRawChange: (value: boolean) => void;
  onCloseDrawer: () => void;
}

export function MonitorDrawer({
  state,
  activeDataset,
  rawTabAvailable,
  onSetDrawerTab,
  onImport,
  onImportTextChange,
  onAllowRawChange,
  onNoRawChange,
  onCloseDrawer,
}: MonitorDrawerProps) {
  if (!state.drawerOpen) {
    return <div className="drawer drawer--closed" aria-hidden="true" />;
  }

  return (
    <Panel
      title="Bottom drawer"
      className="drawer drawer--open"
      actions={
        <button type="button" className="button button--ghost" onClick={onCloseDrawer}>
          Close
        </button>
      }
    >
      <div className="tabs">
        {DRAWER_TABS.filter((tab) => rawTabAvailable || tab !== "raw").map((tab) => (
          <button
            key={tab}
            type="button"
            className={`tabs__pill ${state.drawerTab === tab ? "tabs__pill--active" : ""}`.trim()}
            onClick={(event) => onSetDrawerTab(tab, event.currentTarget)}
          >
            {tab}
          </button>
        ))}
      </div>
      {state.drawerTab === "artifacts" ? (
        <div className="drawer__body">
          {activeDataset.artifacts.length ? (
            activeDataset.artifacts.map((item) => (
              <article key={item.artifactId} className="artifact-card">
                <strong>{item.title}</strong>
                <p>{item.preview}</p>
              </article>
            ))
          ) : (
            <p className="drawer__empty">No artifacts yet.</p>
          )}
        </div>
      ) : null}
      {state.drawerTab === "import" ? (
        <div className="drawer__body">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={state.allowRawImport}
              onChange={(event) => onAllowRawChange(event.target.checked)}
            />
            Raw opt-in
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={state.noRawStorage}
              onChange={(event) => onNoRawChange(event.target.checked)}
            />
            No raw storage
          </label>
          <textarea
            className="import-textarea"
            aria-label="JSON payload to import"
            value={state.importText}
            onChange={(event) => onImportTextChange(event.target.value)}
          />
          <button type="button" className="button" onClick={onImport}>
            Parse and import
          </button>
        </div>
      ) : null}
      {state.drawerTab === "context" ? (
        <div className="drawer__body">
          {activeDataset.promptAssembly ? (
            <PromptAssemblyView assembly={activeDataset.promptAssembly} />
          ) : (
            <p className="drawer__empty">No prompt assembly data available.</p>
          )}
        </div>
      ) : null}
      {state.drawerTab === "raw" ? (
        <pre className="drawer__pre">
          {activeDataset.run.rawIncluded
            ? JSON.stringify(activeDataset, null, 2)
            : "Raw payload hidden by default."}
        </pre>
      ) : null}
      {state.drawerTab === "log" ? (
        <pre className="drawer__pre">{state.exportText || "No export generated yet."}</pre>
      ) : null}
      <div className="drawer__footer">
        <span>{formatTokens(activeDataset.run.summaryMetrics.tokens)}</span>
        <span>{formatCurrency(activeDataset.run.summaryMetrics.costUsd)}</span>
      </div>
    </Panel>
  );
}
