import { describe, expect, it } from "vitest";

import { resolveMonitorUiQaState } from "@/pages/monitor/lib/ui-qa-fixtures";

import { buildTimelineLiveLayout } from "./live-layout";
import { buildTimelineProjection } from "./projection";

function liveProjection() {
  const state = resolveMonitorUiQaState(
    "?demo=ui-qa&tab=live&sidebar=expanded&session=sess-ui-shell",
  );

  if (!state) {
    throw new Error("Expected UI-QA state");
  }

  const projection = buildTimelineProjection(state.detailBySessionId["sess-ui-shell"]);
  if (!projection) {
    throw new Error("Expected timeline projection");
  }

  return projection;
}

describe("buildTimelineLiveLayout", () => {
  it("folds only long idle gaps between activation segments", () => {
    const projection = liveProjection();
    const layout = buildTimelineLiveLayout(projection);

    expect(layout.gapFolds).toHaveLength(1);
    expect(layout.gapFolds[0]).toMatchObject({
      hiddenDurationMs: 60_000,
      label: "+1m idle gap",
    });
  });

  it("keeps turn headers ahead of rendered items without covering the first status point", () => {
    const projection = liveProjection();
    const layout = buildTimelineLiveLayout(projection);
    const turnOneHeader = layout.turnHeaders.find((header) => header.turnBandId === "turn:1");
    const spawnY = layout.itemYById["evt-spawn"];

    if (!turnOneHeader) {
      throw new Error("Expected turn 1 header");
    }

    expect(spawnY).toBeGreaterThan(turnOneHeader.top + turnOneHeader.height);
  });

  it("preserves segment anchor positions and keeps hidden items mapped inside the same flow", () => {
    const projection = liveProjection();
    const layout = buildTimelineLiveLayout(projection);
    const completeConnector = projection.connectors.find((connector) => connector.kind === "complete");

    if (!completeConnector) {
      throw new Error("Expected complete connector");
    }

    expect(layout.itemYById["tool:call-layout"]).toBeGreaterThan(0);
    expect(layout.segmentExitYById[completeConnector.sourceSegmentId]).toBe(
      layout.itemYById[completeConnector.anchorItemId],
    );
    expect(layout.renderItemIdsBySegmentId[completeConnector.sourceSegmentId]).toContain(
      "evt-worker-complete",
    );
  });
});
