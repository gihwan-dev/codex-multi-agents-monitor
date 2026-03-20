import { describe, expect, it } from "vitest";
import { deriveMonitorViewState } from "../src/pages/monitor/model/deriveMonitorViewState.js";
import { createMonitorInitialState } from "../src/pages/monitor/model/state/index.js";

describe("deriveMonitorViewState", () => {
  it("archive index loading과 snapshot loading을 분리해서 유지한다", () => {
    const state = {
      ...createMonitorInitialState(),
      archivedIndexLoading: false,
      archivedSnapshotLoading: true,
    };

    const viewState = deriveMonitorViewState(state);

    expect(viewState.archivedIndexLoading).toBe(false);
    expect(viewState.archivedSnapshotLoading).toBe(true);
  });
});
