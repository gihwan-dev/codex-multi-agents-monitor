import type { MapNode } from "../../../shared/domain";
import { Panel, StatusChip } from "../../../shared/ui";

interface MapViewProps {
  nodes: MapNode[];
}

export function MapView({ nodes }: MapViewProps) {
  const clusterMode = nodes.length > 20;

  return (
    <Panel title="Map" className="canvas-panel">
      {clusterMode ? (
        <p className="map-view__cluster-copy">
          Agent cluster grouping enabled because the lane count exceeded the map threshold.
        </p>
      ) : null}
      <div className="map-view">
        {nodes.map((node) => (
          <article key={node.lane.laneId} className="map-card">
            <div className="map-card__header">
              <strong>{node.lane.name}</strong>
              <StatusChip status={node.lane.laneStatus} subtle />
            </div>
            <p>{node.lane.role}</p>
            <div className="map-card__stats">
              <span>{node.statusCount} events</span>
              <span>{node.waitingCount} waiting</span>
              <span>{node.blockedCount} blocked</span>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}
