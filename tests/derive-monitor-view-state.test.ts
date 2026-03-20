import { describe, expect, it } from "vitest";
import { deriveMonitorViewState } from "../src/pages/monitor/model/deriveMonitorViewState.js";
import { createMonitorInitialState } from "../src/pages/monitor/model/state/index.js";

describe("deriveMonitorViewState", () => {
  it("archive index loading을 파생 상태에 그대로 노출한다", () => {
    const state = {
      ...createMonitorInitialState(),
      archivedIndexLoading: true,
    };

    const viewState = deriveMonitorViewState(state);

    expect(viewState.archivedIndexLoading).toBe(true);
  });
});
