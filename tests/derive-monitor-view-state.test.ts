import { describe, expect, it } from "vitest";
import {
  createMonitorInitialState,
  deriveMonitorViewState,
} from "./helpers/monitorTestApi.js";

describe("deriveMonitorViewState", () => {
  it("archive index loading을 파생 상태에 그대로 노출한다", () => {
    const state = {
      ...createMonitorInitialState(),
      archivedIndexLoading: true,
    };

    const viewState = deriveMonitorViewState(state);

    expect(viewState.archivedIndexLoading).toBe(true);
  });

  it("builds an event reveal target for event selections", () => {
    const state = {
      ...createMonitorInitialState(),
      selection: { kind: "event" as const, id: "fix2-blocked" },
    };

    const viewState = deriveMonitorViewState(state);

    expect(viewState.selectionRevealTarget).toEqual({
      kind: "event",
      eventId: "fix2-blocked",
    });
  });

  it("builds an edge reveal target for edge selections", () => {
    const initialState = createMonitorInitialState();
    const edge = initialState.datasets
      .find((item) => item.run.traceId === "trace-fix-002")
      ?.edges.find((item) => item.edgeType === "handoff");

    expect(edge).toBeDefined();
    if (!edge) {
      throw new Error("handoff edge missing");
    }

    const viewState = deriveMonitorViewState({
      ...initialState,
      selection: { kind: "edge", id: edge.edgeId },
    });

    expect(viewState.selectionRevealTarget).toEqual({
      kind: "edge",
      edgeId: edge.edgeId,
      sourceEventId: edge.sourceEventId,
      targetEventId: edge.targetEventId,
    });
  });

  it("builds an artifact reveal target for artifact selections", () => {
    const initialState = createMonitorInitialState();
    const dataset = initialState.datasets.find((item) => item.run.traceId === "trace-fix-001");

    expect(dataset).toBeDefined();
    if (!dataset) {
      throw new Error("artifact fixture missing");
    }
    const artifact = dataset.artifacts.find(
      (item) => item.artifactId === dataset.run.finalArtifactId,
    );
    expect(artifact).toBeDefined();
    if (!artifact) {
      throw new Error("final artifact missing");
    }

    const viewState = deriveMonitorViewState({
      ...initialState,
      activeRunId: dataset.run.traceId,
      selection: { kind: "artifact", id: artifact.artifactId },
    });

    expect(viewState.selectionRevealTarget).toEqual({
      kind: "artifact",
      artifactId: artifact.artifactId,
      producerEventId: artifact.producerEventId,
    });
  });
});
