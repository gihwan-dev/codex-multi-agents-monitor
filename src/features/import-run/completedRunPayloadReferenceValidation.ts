import type { ValidatedCompletedRunPayload } from "./completedRunPayloadValidationTypes";

function collectUniqueIds<T>(items: T[], label: string, getId: (item: T) => string) {
  const ids = new Set<string>();
  for (const item of items) {
    const id = getId(item);
    if (ids.has(id)) {
      throw new Error(`Invalid payload: duplicate ${label} id ${id}.`);
    }
    ids.add(id);
  }
  return ids;
}

export function validatePayloadReferences(payload: ValidatedCompletedRunPayload) {
  const laneIds = collectUniqueIds(payload.lanes, "lane", (lane) => lane.laneId);
  const eventIds = collectUniqueIds(payload.events, "event", (event) => event.event_id);
  const artifactIds = collectUniqueIds(
    payload.artifacts,
    "artifact",
    (artifact) => artifact.artifactId,
  );
  collectUniqueIds(payload.edges, "edge", (edge) => edge.edgeId);

  payload.events.forEach((event) => {
    if (!laneIds.has(event.lane_id)) {
      throw new Error(
        `Invalid payload: event ${event.event_id} references unknown lane ${event.lane_id}.`,
      );
    }

    if (event.artifact_id && !artifactIds.has(event.artifact_id)) {
      throw new Error(
        `Invalid payload: event ${event.event_id} references unknown artifact ${event.artifact_id}.`,
      );
    }
  });

  payload.edges.forEach((edge) => {
    if (!eventIds.has(edge.sourceEventId)) {
      throw new Error(
        `Invalid payload: edge ${edge.edgeId} references unknown source event ${edge.sourceEventId}.`,
      );
    }

    if (!eventIds.has(edge.targetEventId)) {
      throw new Error(
        `Invalid payload: edge ${edge.edgeId} references unknown target event ${edge.targetEventId}.`,
      );
    }

    if (edge.artifactId && !artifactIds.has(edge.artifactId)) {
      throw new Error(
        `Invalid payload: edge ${edge.edgeId} references unknown artifact ${edge.artifactId}.`,
      );
    }
  });

  payload.artifacts.forEach((artifact) => {
    if (!eventIds.has(artifact.producerEventId)) {
      throw new Error(
        `Invalid payload: artifact ${artifact.artifactId} references unknown producer event ${artifact.producerEventId}.`,
      );
    }
  });

  if (payload.run.selectedByDefaultId && !eventIds.has(payload.run.selectedByDefaultId)) {
    throw new Error(
      `Invalid payload: selectedByDefaultId references unknown event ${payload.run.selectedByDefaultId}.`,
    );
  }

  if (payload.run.finalArtifactId && !artifactIds.has(payload.run.finalArtifactId)) {
    throw new Error(
      `Invalid payload: finalArtifactId references unknown artifact ${payload.run.finalArtifactId}.`,
    );
  }
}
