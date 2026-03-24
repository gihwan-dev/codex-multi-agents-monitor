import { describe, expect, it } from "vitest";
import { buildGraphSceneModel, FIXTURE_DATASETS } from "../src/entities/run/index.js";
import {
  clampGraphScrollTop,
  isRevealRangeVisible,
  resolveSelectionRevealRange,
  resolveSelectionRevealScrollTop,
} from "../src/widgets/causal-graph/lib/graphSelectionReveal.js";
import { buildGraphLayoutSnapshot } from "../src/widgets/causal-graph/model/graphLayout.js";

function requireDataset(traceId: string) {
  const dataset = FIXTURE_DATASETS.find((item) => item.run.traceId === traceId);
  if (!dataset) {
    throw new Error(`fixture dataset missing: ${traceId}`);
  }

  return dataset;
}

describe("graphSelectionReveal", () => {
  it("resolves an edge reveal range that spans both connected events", () => {
    const dataset = requireDataset("trace-fix-002");
    const edge = dataset.edges.find((item) => item.edgeType === "handoff");
    if (!edge) {
      throw new Error("handoff edge missing");
    }

    const scene = buildGraphSceneModel(dataset, { kind: "edge", id: edge.edgeId });
    const layout = buildGraphLayoutSnapshot(scene, 1280);
    const revealRange = resolveSelectionRevealRange(
      {
        kind: "edge",
        edgeId: edge.edgeId,
        sourceEventId: edge.sourceEventId,
        targetEventId: edge.targetEventId,
      },
      layout,
    );

    expect(revealRange).not.toBeNull();
    expect(revealRange?.top).toBeLessThan(revealRange?.bottom ?? 0);

    const sourceLayout = layout.eventById.get(edge.sourceEventId);
    const targetLayout = layout.eventById.get(edge.targetEventId);
    expect(revealRange?.top).toBe(
      Math.min(sourceLayout?.cardRect.y ?? Infinity, targetLayout?.cardRect.y ?? Infinity),
    );
    expect(revealRange?.bottom).toBe(
      Math.max(
        (sourceLayout?.cardRect.y ?? 0) + (sourceLayout?.cardRect.height ?? 0),
        (targetLayout?.cardRect.y ?? 0) + (targetLayout?.cardRect.height ?? 0),
      ),
    );
  });

  it("centers and clamps the navigation scroll target within the rendered height", () => {
    expect(
      resolveSelectionRevealScrollTop(
        { top: 420, bottom: 520, anchorY: 470 },
        200,
        560,
      ),
    ).toBe(360);
    expect(clampGraphScrollTop(999, 0, 320)).toBe(320);
  });

  it("reports whether a reveal range is already fully visible", () => {
    expect(isRevealRangeVisible({ top: 120, bottom: 180, anchorY: 150 }, 100, 200)).toBe(true);
    expect(isRevealRangeVisible({ top: 80, bottom: 180, anchorY: 130 }, 100, 200)).toBe(false);
  });
});
