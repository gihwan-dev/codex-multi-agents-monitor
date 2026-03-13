import { describe, expect, it } from "vitest";

import { resolveMonitorUiQaState } from "@/pages/monitor/lib/ui-qa-fixtures";

import { buildTimelineProjection } from "../projection";
import { buildTimelineLiveDagView } from "./builder";

function liveDag() {
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

  return buildTimelineLiveDagView(projection);
}

describe("buildTimelineLiveDagView", () => {
  it("reuses the first released branch slot for later child sessions", () => {
    const dag = liveDag();
    const workerATrackId = dag.rowsById[dag.rowIdsByItemId["evt-worker-msg"]];
    const workerBTrackId = dag.rowsById[dag.rowIdsByItemId["evt-worker-b-msg"]];
    const branchTracks = dag.tracks.filter((track) => track.kind === "branch");

    expect(workerATrackId).toMatchObject({ kind: "event", trackId: "track:branch:0" });
    expect(workerBTrackId).toMatchObject({ kind: "event", trackId: "track:branch:0" });
    expect(branchTracks).toHaveLength(1);
    expect(branchTracks[0]?.occupancies.map((occupancy) => occupancy.sessionId)).toEqual([
      "sess-ui-shell-worker-a",
      "sess-ui-shell-worker-b",
    ]);
  });

  it("inserts global gap rows between distant semantic rows", () => {
    const dag = liveDag();
    const gapRow = dag.rows.find(
      (row) =>
        row.kind === "gap" &&
        row.sourceRowId === dag.rowIdsByItemId["evt-plan"] &&
        row.targetRowId === dag.rowIdsByItemId["tool:call-layout"],
    );

    expect(gapRow?.kind).toBe("gap");
    if (!gapRow || gapRow.kind !== "gap") {
      throw new Error("Expected a gap row between the plan and tool rows");
    }

    expect(gapRow).toMatchObject({
      hiddenDurationMs: expect.any(Number),
      label: expect.stringContaining("hidden"),
    });
    expect(gapRow.hiddenDurationMs).toBeGreaterThan(dag.gapThresholdMs);
  });

  it("derives connector direction labels and request/response previews", () => {
    const dag = liveDag();
    const spawnEdge = dag.edges.find(
      (edge) =>
        edge.kind === "spawn" &&
        edge.connectorId ===
          "connector:lineage:sess-ui-shell:sess-ui-shell-worker-b:spawn",
    );
    const completeEdge = dag.edges.find(
      (edge) =>
        edge.kind === "complete" &&
        edge.connectorId ===
          "connector:lineage:sess-ui-shell:sess-ui-shell-worker-a:complete",
    );
    const toolEdge = dag.edges.find((edge) => edge.edgeId === "edge:tool:tool:call-layout");

    expect(spawnEdge).toMatchObject({
      directionLabel: "Main -> Curie",
      requestPreview: '{"agent_id":"sess-ui-shell-worker-b","nickname":"Curie"}',
      taxonomy: "branch",
    });
    expect(completeEdge).toMatchObject({
      directionLabel: "Newton -> Main",
      responsePreview:
        "Worker finished the timeline surface patch and returned implementation notes to Main.",
      taxonomy: "flow",
    });
    expect(toolEdge).toMatchObject({
      kind: "tool",
      requestPreview: 'rg -n "TimelineCanvas|DetailDrawer|useSessionDetailQuery" src',
      responsePreview:
        "src/pages/monitor/ui/monitor-page.tsx, src/widgets/timeline/ui/timeline-canvas.tsx, src/widgets/detail-drawer/ui/detail-drawer.tsx",
      taxonomy: "tool",
    });
  });

  it("keeps turn headers ahead of event rows and preserves prompt selection mapping", () => {
    const dag = liveDag();
    const turnHeader = dag.rows.find(
      (row) => row.kind === "turn-header" && row.turnBandId === "turn:1",
    );
    const firstTurnEvent = dag.rows.find(
      (row) => row.kind === "event" && row.turnBandId === "turn:1",
    );

    expect(turnHeader).toMatchObject({
      rowId: "row:turn:turn:1",
      selection: { itemId: "evt-user-1", kind: "item" },
      trackId: "track:user",
    });
    expect(turnHeader?.rowIndex).toBeLessThan(firstTurnEvent?.rowIndex ?? Number.POSITIVE_INFINITY);
  });
});
