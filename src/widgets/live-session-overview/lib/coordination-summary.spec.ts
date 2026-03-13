import { describe, expect, it } from "vitest";

import { buildTimelineProjection } from "@/features/timeline";
import { resolveMonitorUiQaState } from "@/pages/monitor/lib/ui-qa-fixtures";

import { deriveCoordinationSnapshot } from "./coordination-summary";

function liveProjection() {
  const state = resolveMonitorUiQaState(
    "?demo=ui-qa&tab=live&sidebar=expanded&session=sess-ui-shell",
  );

  if (!state) {
    throw new Error("Expected UI-QA state");
  }

  return buildTimelineProjection(state.detailBySessionId["sess-ui-shell"]);
}

describe("deriveCoordinationSnapshot", () => {
  it("최신 turn과 user 제외 participant lanes를 협업 요약으로 만든다", () => {
    const projection = liveProjection();
    const snapshot = deriveCoordinationSnapshot(projection);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.currentTurn.label).toBe("Turn 2");
    expect(snapshot?.participants.label).toBe("2 agent lanes");
    expect(snapshot?.participants.detail).toBe("Main · Newton");
    expect(snapshot?.latestCoordination.label).toContain("Handoff");
  });

  it("connector가 없으면 최신 agent update를 fallback으로 사용한다", () => {
    const projection = liveProjection();

    if (!projection) {
      throw new Error("Expected projection");
    }

    const snapshot = deriveCoordinationSnapshot({
      ...projection,
      connectors: [],
    });

    expect(snapshot?.latestCoordination.label).toBe("No cross-agent coordination yet");
    expect(snapshot?.latestCoordination.detail).toContain("Vertical timeline MVP staged");
  });
});
