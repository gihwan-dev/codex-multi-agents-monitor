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
});
