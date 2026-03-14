import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FIXTURE_DATASETS } from "../src/features/fixtures";
import { CausalGraphView } from "../src/features/run-detail/graph/CausalGraphView";
import {
  buildContinuationGuideYs,
  buildGraphLayoutSnapshot,
  choosePortPair,
  computeLaneMetrics,
  computeRenderedContentHeight,
  computeVisibleEdgeRoutes,
  computeVisibleRowRange,
  EVENT_ROW_HEIGHT,
  GAP_ROW_HEIGHT,
  ROW_GAP,
  TIME_GUTTER,
} from "../src/features/run-detail/graph/graphLayout";
import { buildGraphSceneModel, type GraphSceneModel, type RunFilters } from "../src/shared/domain";

const DEFAULT_FILTERS: RunFilters = {
  agentId: null,
  eventType: "all",
  search: "",
  errorOnly: false,
};

describe("graphLayout", () => {
  it("chooses left/right ports when horizontal distance dominates", () => {
    const pair = choosePortPair(
      { x: 100, y: 100, width: 180, height: 88 },
      { x: 420, y: 160, width: 180, height: 88 },
    );

    expect(pair.orientation).toBe("horizontal");
    expect(pair.sourceSide).toBe("right");
    expect(pair.targetSide).toBe("left");
  });

  it("chooses top/bottom ports when vertical distance dominates", () => {
    const pair = choosePortPair(
      { x: 100, y: 100, width: 180, height: 88 },
      { x: 200, y: 420, width: 180, height: 88 },
    );

    expect(pair.orientation).toBe("vertical");
    expect(pair.sourceSide).toBe("bottom");
    expect(pair.targetSide).toBe("top");
  });

  it("fills available width evenly and overflows when the minimum lane width wins", () => {
    const roomy = computeLaneMetrics(1400, 4);
    const cramped = computeLaneMetrics(700, 4);

    expect(roomy.contentWidth).toBe(1400);
    expect(roomy.laneWidth).toBeCloseTo((1400 - TIME_GUTTER) / 4, 5);
    expect(cramped.laneWidth).toBe(280);
    expect(cramped.contentWidth).toBe(TIME_GUTTER + 280 * 4);
    expect(cramped.contentWidth).toBeGreaterThan(700);
  });

  it("spreads multiple edges on the same side into separate port slots", () => {
    const layout = buildGraphLayoutSnapshot(createSyntheticScene(), 820);
    const sourceOffsets = layout.edgeRoutes
      .map((route) => route.sourcePort.offset)
      .sort((left, right) => left - right);

    expect(sourceOffsets).toEqual([-12, 0, 12]);
  });

  it("centers each event card on the row anchor and exposes one guide per event row", () => {
    const scene = createSyntheticScene();
    const layout = buildGraphLayoutSnapshot(scene, 820);

    expect(layout.rowGuideYByEventId.size).toBe(
      scene.rows.filter((row) => row.kind === "event").length,
    );

    layout.eventById.forEach((eventLayout, eventId) => {
      const cardCenterY = eventLayout.cardRect.y + eventLayout.cardRect.height / 2;

      expect(eventLayout.cardRect.height).toBe(80);
      expect(eventLayout.rowAnchorY).toBe(cardCenterY);
      expect(layout.rowGuideYByEventId.get(eventId)).toBe(eventLayout.rowAnchorY);
    });
  });

  it("uses the larger of content height and available canvas height", () => {
    expect(computeRenderedContentHeight(420, 360)).toBe(420);
    expect(computeRenderedContentHeight(420, 600)).toBe(600);
  });

  it("builds continuation guides only below the real content height", () => {
    const contentHeight = 420;
    const renderedContentHeight = 760;
    const guideYs = buildContinuationGuideYs(contentHeight, renderedContentHeight);

    expect(guideYs[0]).toBe(contentHeight + 16 + 132 / 2);
    expect(guideYs.every((guideY) => guideY > contentHeight)).toBe(true);
    expect(guideYs.at(-1)).toBeLessThanOrEqual(renderedContentHeight);
  });

  it("routes the waiting-chain fixture from more natural horizontal ports", () => {
    const scene = buildFixtureScene("trace-fix-002", { kind: "event", id: "fix2-blocked" });
    const layout = buildGraphLayoutSnapshot(scene, 1240);

    expect(findRouteByPrimaryEdge(scene, layout, "edge-fix2-spawn")?.sourcePort.side).toBe("right");
    expect(findRouteByPrimaryEdge(scene, layout, "edge-fix2-spawn")?.targetPort.side).toBe("left");
    expect(findRouteByPrimaryEdge(scene, layout, "edge-fix2-handoff")?.sourcePort.side).toBe("right");
    expect(findRouteByPrimaryEdge(scene, layout, "edge-fix2-handoff")?.targetPort.side).toBe("left");
    expect(findRouteByPrimaryEdge(scene, layout, "edge-fix2-transfer")?.sourcePort.side).toBe("right");
    expect(findRouteByPrimaryEdge(scene, layout, "edge-fix2-transfer")?.targetPort.side).toBe("left");
  });

  it("keeps dense fixtures at or above the minimum lane width", () => {
    const scene = buildFixtureScene("trace-fix-004", { kind: "event", id: "fix4-lane-1-0" });
    const layout = buildGraphLayoutSnapshot(scene, 900);

    expect(layout.laneMetrics.laneWidth).toBeGreaterThanOrEqual(280);
    expect(layout.contentWidth).toBeGreaterThan(900);
  });

  it("keeps the waiting-chain fixture guide and card center on the same row axis", () => {
    const scene = buildFixtureScene("trace-fix-002", { kind: "event", id: "fix2-blocked" });
    const layout = buildGraphLayoutSnapshot(scene, 1240);

    const waitingLayout = layout.eventById.get("fix2-wait");
    expect(waitingLayout).toBeDefined();
    if (!waitingLayout) {
      throw new Error("fix2-wait layout missing");
    }

    expect(layout.rowGuideYByEventId.get("fix2-wait")).toBe(waitingLayout.rowAnchorY);
    expect(waitingLayout.cardRect.y + waitingLayout.cardRect.height / 2).toBe(waitingLayout.rowAnchorY);
  });

  it("scales card width to 80% of lane width, floored at minimum", () => {
    const wide = computeLaneMetrics(1400, 3);
    expect(wide.cardWidth).toBe(Math.floor(wide.laneWidth * 0.8));

    const narrow = computeLaneMetrics(700, 4);
    expect(narrow.cardWidth).toBe(256);
  });

  it("builds rowPositions with correct topY and height for every row", () => {
    const scene = createSyntheticScene();
    const layout = buildGraphLayoutSnapshot(scene, 820);

    expect(layout.rowPositions.length).toBe(scene.rows.length);

    let expectedY = 0;
    layout.rowPositions.forEach((pos, index) => {
      const row = scene.rows[index];
      const expectedHeight = row.kind === "gap" ? GAP_ROW_HEIGHT : EVENT_ROW_HEIGHT;

      expect(pos.rowIndex).toBe(index);
      expect(pos.topY).toBe(expectedY);
      expect(pos.height).toBe(expectedHeight);
      expect(pos.kind).toBe(row.kind === "gap" ? "gap" : "event");

      expectedY += expectedHeight;
      if (index < scene.rows.length - 1) {
        expectedY += ROW_GAP;
      }
    });
  });

  it("computeVisibleRowRange returns all rows when viewport exceeds content", () => {
    const scene = createSyntheticScene();
    const layout = buildGraphLayoutSnapshot(scene, 820);
    const range = computeVisibleRowRange(layout.rowPositions, 0, 10000, 3);

    expect(range.startIndex).toBe(0);
    expect(range.endIndex).toBe(scene.rows.length);
    expect(range.topPadding).toBe(0);
    expect(range.bottomPadding).toBe(0);
  });

  it("computeVisibleRowRange clips to viewport with overscan", () => {
    const scene = createLargeScene(20);
    const layout = buildGraphLayoutSnapshot(scene, 820);
    const rowHeight = EVENT_ROW_HEIGHT + ROW_GAP;
    const scrollTop = rowHeight * 5;
    const viewportHeight = rowHeight * 3;

    const range = computeVisibleRowRange(layout.rowPositions, scrollTop, viewportHeight, 2);

    expect(range.startIndex).toBeGreaterThanOrEqual(3);
    expect(range.startIndex).toBeLessThanOrEqual(5);
    expect(range.endIndex).toBeGreaterThanOrEqual(8);
    expect(range.endIndex).toBeLessThanOrEqual(11);
    expect(range.endIndex - range.startIndex).toBeLessThan(20);
  });

  it("computeVisibleRowRange handles empty rowPositions", () => {
    const range = computeVisibleRowRange([], 0, 500, 3);

    expect(range.startIndex).toBe(0);
    expect(range.endIndex).toBe(0);
    expect(range.topPadding).toBe(0);
    expect(range.bottomPadding).toBe(0);
  });

  it("computeVisibleRowRange at scrollTop=0 starts from index 0", () => {
    const scene = createLargeScene(20);
    const layout = buildGraphLayoutSnapshot(scene, 820);
    const range = computeVisibleRowRange(layout.rowPositions, 0, 400, 3);

    expect(range.startIndex).toBe(0);
    expect(range.endIndex).toBeGreaterThan(0);
    expect(range.endIndex).toBeLessThanOrEqual(20);
  });

  it("computeVisibleEdgeRoutes filters edges outside viewport", () => {
    const scene = createSyntheticScene();
    const layout = buildGraphLayoutSnapshot(scene, 820);
    const allRoutes = layout.edgeRoutes;
    expect(allRoutes.length).toBeGreaterThan(0);

    const farBelowRoutes = computeVisibleEdgeRoutes(allRoutes, 100000, 500, 500);
    expect(farBelowRoutes.length).toBe(0);

    const allVisibleRoutes = computeVisibleEdgeRoutes(allRoutes, 0, 10000, 500);
    expect(allVisibleRoutes.length).toBe(allRoutes.length);
  });

  it("renders compact cards, continuation guides, and route hitboxes without the old edge hotspot button", () => {
    const dataset = getFixtureDataset("trace-fix-002");
    const scene = buildGraphSceneModel(dataset, DEFAULT_FILTERS, { kind: "event", id: "fix2-blocked" });
    const markup = renderToStaticMarkup(
      createElement(CausalGraphView, {
        scene,
        onSelect: () => undefined,
        followLive: false,
        liveMode: dataset.run.liveMode,
        onPauseFollowLive: () => undefined,
        viewportHeightOverride: 1200,
        laneHeaderHeightOverride: 80,
      }),
    );

    expect(markup).toContain("graph-sequence__route-hitbox");
    expect(markup).toContain("graph-sequence__row-guide");
    expect(markup).toContain("graph-sequence__row-guide--continuation");
    expect(markup).toContain("graph-sequence__row-guide--selected");
    expect(markup).toContain("graph-sequence__row-guide--active");
    expect(markup).toContain("Interactive graph edge hit targets");
    expect(markup).not.toContain("graph-sequence__edge-hotspot");
    expect(markup).not.toContain("Waiting for repo search completion");
    expect(markup).not.toContain("wait_reason:");
  });
});

function createSyntheticScene(): GraphSceneModel {
  return {
    lanes: [
      {
        laneId: "planner",
        name: "Planner",
        role: "orchestrator",
        model: "gpt-5",
        badge: "Main",
        status: "running",
      },
      {
        laneId: "writer",
        name: "Writer",
        role: "worker",
        model: "gpt-5-mini",
        badge: "Worktree",
        status: "waiting",
      },
      {
        laneId: "verifier",
        name: "Verifier",
        role: "verification",
        model: "gpt-5-mini",
        badge: "Check",
        status: "waiting",
      },
    ],
    rows: [
      makeEventRow("target-a", "writer", "Target A"),
      makeEventRow("src", "planner", "Source"),
      makeEventRow("target-b", "writer", "Target B"),
      makeEventRow("target-c", "verifier", "Target C"),
    ],
    edgeBundles: [
      makeEdgeBundle("edge-a", "src", "target-a", "handoff", "planner", "writer"),
      makeEdgeBundle("edge-b", "src", "target-b", "handoff", "planner", "writer"),
      makeEdgeBundle("edge-c", "src", "target-c", "handoff", "planner", "verifier"),
    ],
    selectionPath: {
      eventIds: [],
      edgeIds: [],
      laneIds: [],
    },
    hiddenLaneCount: 0,
    latestVisibleEventId: "target-c",
  };
}

function makeEventRow(eventId: string, laneId: string, title: string): GraphSceneModel["rows"][number] {
  return {
    kind: "event",
    id: `row-${eventId}`,
    eventId,
    laneId,
    title,
    summary: title,
    status: "running",
    waitReason: null,
    timeLabel: "6:00 PM",
    durationLabel: "1s",
    inPath: false,
    selected: false,
    dimmed: false,
  };
}

function makeEdgeBundle(
  edgeId: string,
  sourceEventId: string,
  targetEventId: string,
  edgeType: "handoff" | "spawn" | "transfer" | "merge",
  sourceLaneId: string,
  targetLaneId: string,
): GraphSceneModel["edgeBundles"][number] {
  return {
    id: edgeId,
    primaryEdgeId: edgeId,
    edgeIds: [edgeId],
    sourceEventId,
    targetEventId,
    sourceLaneId,
    targetLaneId,
    edgeType,
    label: edgeId,
    bundleCount: 1,
    inPath: false,
    selected: false,
  };
}

function buildFixtureScene(
  traceId: string,
  selection: { kind: "event"; id: string },
) {
  const dataset = getFixtureDataset(traceId);
  return buildGraphSceneModel(dataset, DEFAULT_FILTERS, selection);
}

function findRouteByPrimaryEdge(
  scene: GraphSceneModel,
  layout: ReturnType<typeof buildGraphLayoutSnapshot>,
  edgeId: string,
) {
  const bundle = scene.edgeBundles.find((item) => item.primaryEdgeId === edgeId);
  return bundle ? layout.edgeRoutes.find((route) => route.bundleId === bundle.id) : undefined;
}

function createLargeScene(eventCount: number): GraphSceneModel {
  const rows: GraphSceneModel["rows"] = [];
  for (let index = 0; index < eventCount; index += 1) {
    rows.push(makeEventRow(`event-${index}`, "planner", `Event ${index}`));
  }

  return {
    lanes: [
      {
        laneId: "planner",
        name: "Planner",
        role: "orchestrator",
        model: "gpt-5",
        badge: "Main",
        status: "running",
      },
    ],
    rows,
    edgeBundles: [],
    selectionPath: { eventIds: [], edgeIds: [], laneIds: [] },
    hiddenLaneCount: 0,
    latestVisibleEventId: `event-${eventCount - 1}`,
  };
}

function getFixtureDataset(traceId: string) {
  const dataset = FIXTURE_DATASETS.find((item) => item.run.traceId === traceId);
  if (!dataset) {
    throw new Error(`fixture ${traceId} missing`);
  }
  return dataset;
}
