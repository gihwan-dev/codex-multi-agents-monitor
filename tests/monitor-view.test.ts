import { describe, expect, it } from "vitest";
import { createMonitorInitialState } from "../src/pages/monitor/model/state/index.js";
import { buildExpandedGapIds, buildExpandedGaps } from "../src/widgets/causal-graph/model/expandedGaps.js";

describe("monitorView helpers", () => {
  it("returns no expanded gaps when the user has not toggled any gap", () => {
    const dataset = createMonitorInitialState().datasets[0];
    expect(dataset).toBeDefined();
    if (!dataset) {
      throw new Error("fixture dataset missing");
    }

    const expandedGapIds = buildExpandedGapIds([], []);

    expect(expandedGapIds.size).toBe(0);
    expect(buildExpandedGaps([], expandedGapIds, dataset.events)).toEqual([]);
  });

  it("maps toggled gap rows to their hidden events", () => {
    const dataset = createMonitorInitialState().datasets[0];
    expect(dataset).toBeDefined();
    if (!dataset) {
      throw new Error("fixture dataset missing");
    }

    const hiddenEvents = dataset.events.slice(0, 2);
    const gapRow = {
      kind: "gap" as const,
      id: "gap-1",
      label: "2 hidden events",
      idleLaneCount: 1,
      durationMs: 18_000,
      hiddenEventIds: hiddenEvents.map((event) => event.eventId),
    };
    const expandedGapIds = buildExpandedGapIds([gapRow], [gapRow.id]);
    const expandedGaps = buildExpandedGaps([gapRow], expandedGapIds, dataset.events);

    expect(expandedGapIds.has(gapRow.id)).toBe(true);
    expect(expandedGaps).toHaveLength(1);
    expect(expandedGaps[0]?.gapId).toBe(gapRow.id);
    expect(expandedGaps[0]?.hiddenEvents.map((event) => event.eventId)).toEqual(gapRow.hiddenEventIds);
  });
});
