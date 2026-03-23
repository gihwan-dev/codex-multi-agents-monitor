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

  validateEventReferences(payload, laneIds, artifactIds);
  validateEdgeReferences(payload, eventIds, artifactIds);
  validateArtifactReferences(payload, eventIds);
  validateRunReferences(payload, eventIds, artifactIds);
}

function validateEventReferences(
  payload: ValidatedCompletedRunPayload,
  laneIds: Set<string>,
  artifactIds: Set<string>,
) {
  payload.events.forEach((event) => {
    assertKnownReference(
      laneIds,
      event.lane_id,
      `event ${event.event_id} references unknown lane`,
    );

    if (event.artifact_id) {
      assertKnownReference(
        artifactIds,
        event.artifact_id,
        `event ${event.event_id} references unknown artifact`,
      );
    }
  });
}

function validateEdgeReferences(
  payload: ValidatedCompletedRunPayload,
  eventIds: Set<string>,
  artifactIds: Set<string>,
) {
  payload.edges.forEach((edge) => {
    assertKnownReference(
      eventIds,
      edge.sourceEventId,
      `edge ${edge.edgeId} references unknown source event`,
    );
    assertKnownReference(
      eventIds,
      edge.targetEventId,
      `edge ${edge.edgeId} references unknown target event`,
    );

    if (edge.artifactId) {
      assertKnownReference(
        artifactIds,
        edge.artifactId,
        `edge ${edge.edgeId} references unknown artifact`,
      );
    }
  });
}

function validateArtifactReferences(
  payload: ValidatedCompletedRunPayload,
  eventIds: Set<string>,
) {
  payload.artifacts.forEach((artifact) => {
    assertKnownReference(
      eventIds,
      artifact.producerEventId,
      `artifact ${artifact.artifactId} references unknown producer event`,
    );
  });
}

function validateRunReferences(
  payload: ValidatedCompletedRunPayload,
  eventIds: Set<string>,
  artifactIds: Set<string>,
) {
  if (payload.run.selectedByDefaultId) {
    assertKnownReference(
      eventIds,
      payload.run.selectedByDefaultId,
      "selectedByDefaultId references unknown event",
    );
  }

  if (payload.run.finalArtifactId) {
    assertKnownReference(
      artifactIds,
      payload.run.finalArtifactId,
      "finalArtifactId references unknown artifact",
    );
  }
}

function assertKnownReference(
  knownIds: Set<string>,
  id: string,
  prefix: string,
) {
  if (!knownIds.has(id)) {
    throw new Error(`Invalid payload: ${prefix} ${id}.`);
  }
}
