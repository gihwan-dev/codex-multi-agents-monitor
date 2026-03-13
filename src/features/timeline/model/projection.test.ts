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

function timelineProjection(detail: SessionDetailSnapshot = timelineDetail()) {
  const projection = buildTimelineProjection(detail);

  if (!projection) {
    throw new Error("Expected timeline projection");
  }

  return projection;
}

describe("buildTimelineProjection", () => {
  it("orders lanes as user, main, then additional lanes", () => {
    const projection = timelineProjection();

    expect(projection.lanes.map((lane) => lane.label)).toEqual([
      "User",
      "Main",
      "Newton",
      "Curie",
    ]);
    expect(projection.lanes[2]?.laneId).not.toBe(projection.lanes[3]?.laneId);
    expect(projection.lanes[2]?.ownerSessionId).toBe("sess-ui-shell-worker-a");
    expect(projection.lanes[3]?.ownerSessionId).toBe("sess-ui-shell-worker-b");
  });

  it("keeps the main lane second even when another agent emits earlier", () => {
    const detail = structuredClone(timelineDetail()) as SessionDetailSnapshot;
    const workerMessage = detail.timeline.events.find(
      (event) => event.event_id === "evt-worker-msg",
    );

    if (!workerMessage) {
      throw new Error("Expected worker fixture event");
    }

    workerMessage.occurred_at = "2026-03-12T12:20:05.000Z";

    const projection = timelineProjection(detail);

    expect(projection.lanes.map((lane) => lane.label)).toEqual([
      "User",
      "Main",
      "Newton",
      "Curie",
    ]);
  });

  it("keeps the root session lane labeled as main even without explicit main role metadata", () => {
    const detail = structuredClone(timelineDetail()) as SessionDetailSnapshot;

    for (const event of detail.timeline.events) {
      if (event.session_id !== "sess-ui-shell") {
        continue;
      }

      if (typeof event.meta.agent_role === "string") {
        delete event.meta.agent_role;
      }
    }

    const projection = timelineProjection(detail);

    expect(projection.lanes.map((lane) => lane.label)).toEqual([
      "User",
      "Main",
      "Newton",
      "Curie",
    ]);
  });

  it("merges tool call and output items by call id and hides token snapshots from the main list", () => {
    const projection = timelineProjection();

    expect(projection.items.some((item) => item.itemId === "evt-token-main")).toBe(false);

    const mergedTool = projection.itemsById["tool:call-layout"];

    expect(mergedTool).toMatchObject({
      inputPreview: 'rg -n "TimelineCanvas|DetailDrawer|useSessionDetailQuery" src',
      kind: "tool",
      label: "Inspect live monitor layout boundaries.",
    });
    expect(mergedTool?.outputPreview).toContain("monitor-page.tsx");
    expect(projection.sessionTokenTotals).toEqual({
      input: 5398,
      output: 360,
    });
  });

  it("keeps the latest non-token item at the bottom of the projection", () => {
    const projection = timelineProjection();

    expect(projection.latestItemId).toBe("evt-complete");
    expect(projection.items[projection.items.length - 1]?.itemId).toBe("evt-complete");
  });

  it("builds user-turn bands and connector chains for handoff, spawn, and completion", () => {
    const projection = timelineProjection();

    expect(projection.turnBands.map((turn) => turn.label)).toEqual(["Turn 1", "Turn 2"]);
    expect(projection.connectors.map((connector) => connector.kind)).toEqual([
      "spawn",
      "complete",
      "spawn",
      "complete",
      "handoff",
      "handoff",
    ]);
    expect(projection.lineageRelations).toEqual([
      expect.objectContaining({
        child_session_id: "sess-ui-shell-worker-a",
        expected_child_session_id: "sess-ui-shell-worker-a",
        parent_session_id: "sess-ui-shell",
        state: "resolved",
        resolution: "explicit",
        spawn_event_id: "evt-spawn",
      }),
      expect.objectContaining({
        child_session_id: "sess-ui-shell-worker-b",
        expected_child_session_id: "sess-ui-shell-worker-b",
        parent_session_id: "sess-ui-shell",
        state: "resolved",
        resolution: "explicit",
        spawn_event_id: "evt-spawn-worker-b",
      }),
    ]);
  });

  it("keeps pending lineage relations out of explicit connector generation", () => {
    const detail = structuredClone(timelineDetail()) as SessionDetailSnapshot;
    detail.timeline.lineage_relations.push({
      relation_id: "lineage:sess-ui-shell:sess-ui-shell-worker-pending:pending:evt-spawn",
      parent_session_id: "sess-ui-shell",
      child_session_id: null,
      expected_child_session_id: "sess-ui-shell-worker-pending",
      state: "pending",
      resolution: null,
      spawn_event_id: "evt-spawn",
    });

    const projection = timelineProjection(detail);

    expect(projection.lineageRelations[projection.lineageRelations.length - 1]).toEqual(
      expect.objectContaining({
        state: "pending",
        child_session_id: null,
        expected_child_session_id: "sess-ui-shell-worker-pending",
      }),
    );
    expect(projection.connectors.map((connector) => connector.kind)).toEqual([
      "spawn",
      "complete",
      "spawn",
      "complete",
      "handoff",
      "handoff",
    ]);
  });

  it("anchors segment and connector selections to an item while exposing the full turn chain", () => {
    const projection = timelineProjection();
    const workerSegment = projection.activationSegments.find(
      (segment) => segment.anchorItemId === "evt-worker-complete",
    );
    const completeConnector = projection.connectors.find((connector) => connector.kind === "complete");

    if (!workerSegment || !completeConnector) {
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
