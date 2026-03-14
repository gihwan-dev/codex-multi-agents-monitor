import { formatDuration, type RunDataset, type RunGroup } from "../../shared/domain";
import { Panel, StatusChip } from "../../shared/ui";

interface RunListPaneProps {
  groups: RunGroup[];
  activeRunId: string;
  onSelectRun: (traceId: string) => void;
}

export function RunListPane({ groups, activeRunId, onSelectRun }: RunListPaneProps) {
  return (
    <Panel title="Run Home" className="run-list">
      {groups.map((group) => (
        <section key={group.title} className="run-list__group">
          <header className="run-list__group-header">
            <strong>{group.title}</strong>
            <span>{group.runs.length}</span>
          </header>
          <div className="run-list__items">
            {group.runs.length ? (
              group.runs.map((dataset) => (
                <RunListCard
                  key={dataset.run.traceId}
                  dataset={dataset}
                  active={dataset.run.traceId === activeRunId}
                  onSelectRun={onSelectRun}
                />
              ))
            ) : (
              <p className="run-list__empty">No runs in this group.</p>
            )}
          </div>
        </section>
      ))}
    </Panel>
  );
}

function RunListCard({
  dataset,
  active,
  onSelectRun,
}: {
  dataset: RunDataset;
  active: boolean;
  onSelectRun: (traceId: string) => void;
}) {
  return (
    <button
      type="button"
      className={`run-card ${active ? "run-card--active" : ""}`.trim()}
      onClick={() => onSelectRun(dataset.run.traceId)}
    >
      <div className="run-card__title-row">
        <strong>{dataset.run.title}</strong>
        <StatusChip status={dataset.run.status} subtle />
      </div>
      <p className="run-card__project">
        {dataset.project.name} · {dataset.session.title}
      </p>
      <div className="run-card__meta-row">
        <span>{dataset.run.summaryMetrics.agentCount} agents</span>
        <span>{formatDuration(dataset.run.summaryMetrics.totalDurationMs)}</span>
        <span>{dataset.run.summaryMetrics.errorCount} errors</span>
      </div>
      <p className="run-card__project">Last update {new Date(dataset.run.startTs).toLocaleTimeString()}</p>
    </button>
  );
}
