import { describe, expect, it } from "vitest";
import { FIXTURE_DATASETS } from "../src/features/fixtures";
import { buildGraphSceneModel, type RunFilters, type SelectionState } from "../src/shared/domain";

const DEFAULT_FILTERS: RunFilters = {
  agentId: null,
  eventType: "all",
  search: "",
  errorOnly: false,
};

function buildDefaultSelection(traceId: string): SelectionState | null {
  const dataset = FIXTURE_DATASETS.find((item) => item.run.traceId === traceId);
  if (!dataset?.run.selectedByDefaultId) {
    return null;
  }
  return { kind: "event", id: dataset.run.selectedByDefaultId };
}

describe("buildGraphSceneModel", () => {
  it("builds sequence-friendly rows and cross-lane bundles for the waiting chain fixture", () => {
    const dataset = FIXTURE_DATASETS.find((item) => item.run.traceId === "trace-fix-002");
    expect(dataset).toBeDefined();
    if (!dataset) {
      throw new Error("waiting-chain fixture missing");
    }

    const scene = buildGraphSceneModel(
      dataset,
      DEFAULT_FILTERS,
      buildDefaultSelection("trace-fix-002"),
      false,
    );

    expect(scene.rows.some((row) => row.kind === "event" && row.eventId === "fix2-blocked")).toBe(true);
    expect(scene.edgeBundles.length).toBeGreaterThan(0);
    expect(scene.edgeBundles.every((bundle) => bundle.sourceLaneId !== bundle.targetLaneId)).toBe(true);
    expect(scene.latestVisibleEventId).toBe(
      [...scene.rows].reverse().find((row) => row.kind === "event")?.eventId ?? null,
    );
  });

  it("folds inactive done lanes for the dense parallel fixture while keeping the active path", () => {
    const dataset = FIXTURE_DATASETS.find((item) => item.run.traceId === "trace-fix-004");
    expect(dataset).toBeDefined();
    if (!dataset) {
      throw new Error("dense-parallel fixture missing");
    }

    const scene = buildGraphSceneModel(
      dataset,
      DEFAULT_FILTERS,
      { kind: "event", id: "fix4-lane-1-0" },
      true,
    );

    expect(scene.hiddenLaneCount).toBeGreaterThan(0);
    expect(scene.lanes.length).toBeLessThan(dataset.lanes.length);
    expect(scene.rows.some((row) => row.kind === "event" && row.inPath)).toBe(true);
  });
});
