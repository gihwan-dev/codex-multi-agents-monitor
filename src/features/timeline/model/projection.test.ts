import { describe, expect, it } from "vitest";

import { resolveMonitorUiQaState } from "@/pages/monitor/lib/ui-qa-fixtures";
import type { SessionDetailSnapshot } from "@/shared/queries";

import { buildTimelineProjection, resolveTimelineSelection } from "./projection";

function timelineDetail() {
  const state = resolveMonitorUiQaState(
    "?demo=ui-qa&tab=live&sidebar=expanded&session=sess-ui-shell",
  );

  if (!state) {
    throw new Error("Expected UI-QA state");
  }

  return state.detailBySessionId["sess-ui-shell"];
}

describe("buildTimelineProjection", () => {
  it("orders lanes as user, main, then additional lanes", () => {
    const projection = buildTimelineProjection(timelineDetail());

    expect(projection).not.toBeNull();
    expect(projection?.lanes.map((lane) => lane.label)).toEqual([
      "User",
      "Main",
      "Newton",
    ]);
  });

  it("keeps the main lane second even when another agent emits earlier", () => {
    const detail = structuredClone(timelineDetail()) as SessionDetailSnapshot;
    const workerMessage = detail.bundle.events.find(
      (event) => event.event_id === "evt-worker-msg",
    );

    if (!workerMessage) {
      throw new Error("Expected worker fixture event");
    }

    workerMessage.occurred_at = "2026-03-12T12:20:05.000Z";

    const projection = buildTimelineProjection(detail);

    expect(projection?.lanes.map((lane) => lane.label)).toEqual([
      "User",
      "Main",
      "Newton",
    ]);
  });

  it("merges tool call and output items by call id and hides token snapshots from the main list", () => {
    const projection = buildTimelineProjection(timelineDetail());

    expect(projection).not.toBeNull();
    expect(projection?.items.some((item) => item.itemId === "evt-token-main")).toBe(false);

    const mergedTool = projection?.itemsById["tool:call-layout"];

    expect(mergedTool).toMatchObject({
      inputPreview: 'rg -n "TimelineCanvas|DetailDrawer|useSessionDetailQuery" src',
      kind: "tool",
      label: "Inspect live monitor layout boundaries.",
    });
    expect(mergedTool?.outputPreview).toContain("monitor-page.tsx");
    expect(projection?.sessionTokenTotals).toEqual({
      input: 5398,
      output: 360,
    });
  });

  it("keeps the latest non-token item at the bottom of the projection", () => {
    const projection = buildTimelineProjection(timelineDetail());

    expect(projection?.latestItemId).toBe("evt-complete");
    expect(projection?.items[projection.items.length - 1]?.itemId).toBe("evt-complete");
  });

  it("builds user-turn bands and connector chains for handoff, spawn, and completion", () => {
    const projection = buildTimelineProjection(timelineDetail());

    expect(projection?.turnBands.map((turn) => turn.label)).toEqual(["Turn 1", "Turn 2"]);
    expect(projection?.connectors.map((connector) => connector.kind)).toEqual([
      "handoff",
      "spawn",
      "complete",
      "handoff",
    ]);
  });

  it("anchors segment and connector selections to an item while exposing the full turn chain", () => {
    const projection = buildTimelineProjection(timelineDetail());
    const workerSegment = projection?.activationSegments.find(
      (segment) => segment.anchorItemId === "evt-worker-complete",
    );
    const completeConnector = projection?.connectors.find((connector) => connector.kind === "complete");

    if (!projection || !workerSegment || !completeConnector) {
      throw new Error("Expected worker segment and complete connector");
    }

    const segmentContext = resolveTimelineSelection(projection, {
      anchorItemId: workerSegment.anchorItemId,
      kind: "segment",
      segmentId: workerSegment.segmentId,
    });
    const connectorContext = resolveTimelineSelection(projection, {
      anchorItemId: completeConnector.anchorItemId,
      connectorId: completeConnector.connectorId,
      kind: "connector",
    });

    expect(segmentContext?.selectedItem?.itemId).toBe("evt-worker-complete");
    expect(segmentContext?.selectedSegment?.segmentId).toBe(workerSegment.segmentId);
    expect(segmentContext?.selectedTurnBand?.turnBandId).toBe("turn:1");
    expect(segmentContext?.relatedItemIds).toHaveLength(9);

    expect(connectorContext?.selectedConnector?.connectorId).toBe(completeConnector.connectorId);
    expect(connectorContext?.selectedItem?.itemId).toBe("evt-worker-complete");
    expect(connectorContext?.relatedConnectorIds).toEqual(
      expect.arrayContaining([completeConnector.connectorId]),
    );
  });
});
