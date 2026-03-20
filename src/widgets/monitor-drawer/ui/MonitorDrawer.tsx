import {
  DRAWER_TABS,
  type DrawerTab,
  type RunDataset,
} from "../../../entities/run";
import { formatCurrency, formatTokens } from "../../../shared/lib/format";
import { Panel } from "../../../shared/ui";
import { PromptAssemblyView } from "../../prompt-assembly";
import "./monitor-drawer.css";

interface MonitorDrawerState {
  drawerOpen: boolean;
  drawerTab: DrawerTab;
  allowRawImport: boolean;
  noRawStorage: boolean;
  importText: string;
  exportText: string;
}

interface MonitorDrawerProps {
  drawerState: MonitorDrawerState;
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
  drawerState,
  activeDataset,
  rawTabAvailable,
  onSetDrawerTab,
  onImport,
  onImportTextChange,
  onAllowRawChange,
  onNoRawChange,
  onCloseDrawer,
}: MonitorDrawerProps) {
  if (!drawerState.drawerOpen) {
    return <div className="drawer drawer--closed" aria-hidden="true" />;
  }

  return (
    <Panel
      title="Bottom drawer"
      className="drawer drawer--open"
      actions={
        <button
          type="button"
          className="button button--ghost"
          aria-label="Close drawer"
          onClick={onCloseDrawer}
        >
          Close
        </button>
      }
    >
      <div className="tabs">
        {DRAWER_TABS.filter((tab) => rawTabAvailable || tab !== "raw").map((tab) => (
          <button
            key={tab}
            type="button"
            className={`tabs__pill ${drawerState.drawerTab === tab ? "tabs__pill--active" : ""}`.trim()}
            onClick={(event) => onSetDrawerTab(tab, event.currentTarget)}
          >
            {tab}
          </button>
        ))}
      </div>
      {drawerState.drawerTab === "artifacts" ? (
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
      {drawerState.drawerTab === "import" ? (
        <div className="drawer__body">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={drawerState.allowRawImport}
              onChange={(event) => onAllowRawChange(event.target.checked)}
            />
            Raw opt-in
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={drawerState.noRawStorage}
              onChange={(event) => onNoRawChange(event.target.checked)}
            />
            No raw storage
          </label>
          <textarea
            className="import-textarea"
            aria-label="JSON payload to import"
            value={drawerState.importText}
            onChange={(event) => onImportTextChange(event.target.value)}
          />
          <button type="button" className="button" onClick={onImport}>
            Parse and import
          </button>
        </div>
      ) : null}
      {drawerState.drawerTab === "context" ? (
        <div className="drawer__body">
          {activeDataset.promptAssembly ? (
            <PromptAssemblyView
              assembly={activeDataset.promptAssembly}
              rawEnabled={activeDataset.run.rawIncluded}
            />
          ) : (
            <p className="drawer__empty">No prompt assembly data available.</p>
          )}
        </div>
      ) : null}
      {drawerState.drawerTab === "raw" ? (
        <pre className="drawer__pre">
          {activeDataset.run.rawIncluded
            ? JSON.stringify(activeDataset, null, 2)
            : "Raw payload hidden by default."}
        </pre>
      ) : null}
      {drawerState.drawerTab === "log" ? (
        <pre className="drawer__pre">{drawerState.exportText || "No export generated yet."}</pre>
      ) : null}
      <div className="drawer__footer">
        <span>{formatTokens(activeDataset.run.summaryMetrics.tokens)}</span>
        <span>{formatCurrency(activeDataset.run.summaryMetrics.costUsd)}</span>
      </div>
    </Panel>
  );
}
