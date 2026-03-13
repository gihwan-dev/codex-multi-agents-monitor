import { describe, expect, it } from "vitest";

import { resolveMonitorUiQaState } from "@/pages/monitor/lib/ui-qa-fixtures";

import { buildTimelineLiveLayout } from "./live-layout";
import { buildTimelineProjection } from "./projection";
import {
  createInitialTimelineViewport,
  disableTimelineFollow,
  refollowLatest,
  timelineContentHeight,
  zoomTimelineViewport,
} from "./viewport";

function timelineProjection() {
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

describe("timeline viewport helpers", () => {
  it("uses compact latest-follow in live mode", () => {
    const projection = timelineProjection();
    const liveLayout = buildTimelineLiveLayout(projection);
    const viewport = createInitialTimelineViewport(projection, "live", 600, liveLayout);
    const contentHeight = timelineContentHeight(projection, viewport.pixelsPerMs, liveLayout);

    expect(viewport.followLatest).toBe(true);
    expect(viewport.renderMode).toBe("live-compact");
    expect(viewport.scrollTop).toBe(contentHeight - 600);
  });

  it("uses fit-all and disabled follow in archive mode", () => {
    const projection = timelineProjection();
    const liveViewport = createInitialTimelineViewport(
      projection,
      "live",
      600,
      buildTimelineLiveLayout(projection),
    );
    const archiveViewport = createInitialTimelineViewport(projection, "archive", 600);

    expect(archiveViewport.followLatest).toBe(false);
    expect(archiveViewport.renderMode).toBe("archive-absolute");
    expect(archiveViewport.scrollTop).toBe(0);
    expect(liveViewport.renderMode).toBe("live-compact");
    expect(archiveViewport.pixelsPerMs).toBeGreaterThan(0);
  });

  it("turns follow off on interaction and restores it with refollow", () => {
    const projection = timelineProjection();
    const liveLayout = buildTimelineLiveLayout(projection);
    const viewport = createInitialTimelineViewport(projection, "live", 600, liveLayout);
    const manualViewport = disableTimelineFollow(viewport, 120);
    const refollowed = refollowLatest(projection, manualViewport, 600, liveLayout);

    expect(manualViewport.followLatest).toBe(false);
    expect(manualViewport.scrollTop).toBe(120);
    expect(refollowed.followLatest).toBe(true);
    expect(refollowed.scrollTop).toBeGreaterThan(manualViewport.scrollTop);
  });

  it("keeps zoom interaction on archive absolute mode only", () => {
    const projection = timelineProjection();
    const viewport = createInitialTimelineViewport(projection, "archive", 600);
    const next = zoomTimelineViewport({
      anchorY: 280,
      deltaY: -120,
      projection,
      viewport,
      viewportHeight: 600,
    });

    expect(next.followLatest).toBe(false);
    expect(next.pixelsPerMs).toBeGreaterThan(viewport.pixelsPerMs);
  });
});
