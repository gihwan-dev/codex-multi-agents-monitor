import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { findSelectedSession } from "@/entities/session";
import { resolveMonitorUiQaState } from "@/pages/monitor/lib/ui-qa-fixtures";

import { buildTimelineProjection } from "../model/projection";
import type { TimelineMode, TimelineSelection } from "../model/types";
import { DetailDrawer } from "./detail-drawer";
import { TimelineCanvas } from "./timeline-canvas";

afterEach(() => {
  cleanup();
});

function createHarnessState() {
  const state = resolveMonitorUiQaState(
    "?demo=ui-qa&tab=live&sidebar=expanded&session=sess-ui-shell",
  );

  if (!state) {
    throw new Error("Expected UI-QA state");
  }

  const selectedSession = findSelectedSession(state.snapshot, state.selectedSessionId);
  const detail = state.detailBySessionId[state.selectedSessionId];
  const projection = buildTimelineProjection(detail);

  if (!selectedSession || !projection) {
    throw new Error("Expected selected session and projection");
  }

  return {
    projection,
    selectedSession,
  };
}

function TimelineHarness({ mode }: { mode: TimelineMode }) {
  const { projection, selectedSession } = createHarnessState();
  const [selection, setSelection] = useState<TimelineSelection>({ kind: "session" });
  const selectedItem =
    selection.kind === "item" ? projection.itemsById[selection.itemId] ?? null : null;

  return (
    <div className="grid h-[920px] grid-cols-[minmax(0,1fr)_380px] gap-5">
      <TimelineCanvas
        mode={mode}
        onSelectionChange={setSelection}
        projection={projection}
        selectedItem={selectedItem}
        selectedSession={selectedSession}
        selection={selection}
      />
      <DetailDrawer
        onSelectionChange={setSelection}
        projection={projection}
        selectedItem={selectedItem}
        selectedSession={selectedSession}
        selection={selection}
      />
    </div>
  );
}

describe("timeline + detail drawer", () => {
  it("renders safely when no detail payload is selected yet", () => {
    render(
      <div className="grid h-[920px] grid-cols-[minmax(0,1fr)_380px] gap-5">
        <TimelineCanvas
          mode="live"
          onSelectionChange={() => {}}
          projection={null}
          selectedItem={null}
          selectedSession={null}
          selection={{ kind: "session" }}
        />
        <DetailDrawer
          onSelectionChange={() => {}}
          projection={null}
          selectedItem={null}
          selectedSession={null}
          selection={{ kind: "session" }}
        />
      </div>,
    );

    expect(screen.getByText("No active session context")).toBeVisible();
    expect(screen.getByText("Event detail")).toBeVisible();
  });

  it("syncs selection from a timeline item into the drawer", () => {
    render(<TimelineHarness mode="live" />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Apply the timeline and drawer wiring patch.",
      }),
    );

    const drawer = within(screen.getByTestId("timeline-detail-drawer"));

    expect(drawer.getByText("Apply the timeline and drawer wiring patch.")).toBeVisible();
    expect(drawer.getByText("tool selection in agent:worker.")).toBeVisible();

    fireEvent.click(drawer.getByRole("tab", { name: "Input-Output" }));

    expect(
      drawer.getByText("update timeline selection source-of-truth in monitor page"),
    ).toBeVisible();
    expect(
      drawer.getByText(
        "features/timeline/ui/* plus page wiring now control selection and latest follow.",
      ),
    ).toBeVisible();
  });

  it("disables latest follow when the user scrubs and restores it with the eye button", () => {
    render(<TimelineHarness mode="live" />);

    const scrollArea = screen.getByTestId("timeline-scroll-area");
    Object.defineProperty(scrollArea, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 600,
        height: 600,
        left: 0,
        right: 800,
        top: 0,
        width: 800,
        x: 0,
        y: 0,
      }),
    });

    fireEvent.wheel(scrollArea, {
      clientY: 240,
      ctrlKey: true,
      deltaY: -120,
    });

    expect(screen.getByTestId("timeline-follow-state")).toHaveTextContent("Manual review");
    expect(screen.getByTestId("timeline-refollow-button")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.click(screen.getByTestId("timeline-refollow-button"));

    expect(screen.getByTestId("timeline-follow-state")).toHaveTextContent(
      "Following latest",
    );
    expect(screen.getByTestId("timeline-refollow-button")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("uses the archive preset without exposing the live follow control", () => {
    render(<TimelineHarness mode="archive" />);

    expect(screen.getByTestId("timeline-follow-state")).toHaveTextContent("Archive fit");
    expect(screen.queryByTestId("timeline-refollow-button")).not.toBeInTheDocument();
  });
});
