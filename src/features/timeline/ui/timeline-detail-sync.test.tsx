import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { findSelectedSession } from "@/entities/session";
import { resolveMonitorUiQaState } from "@/pages/monitor/lib/ui-qa-fixtures";

import { buildTimelineProjection, resolveTimelineSelection } from "../model/projection";
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
  const selectionContext = resolveTimelineSelection(projection, selection);

  return (
    <div className="grid h-[920px] grid-cols-[minmax(0,1fr)_380px] gap-5">
      <TimelineCanvas
        mode={mode}
        onSelectionChange={setSelection}
        projection={projection}
        selectedSession={selectedSession}
        selection={selection}
        selectionContext={selectionContext}
      />
      <DetailDrawer
        onSelectionChange={setSelection}
        projection={projection}
        selectedSession={selectedSession}
        selection={selection}
        selectionContext={selectionContext}
      />
    </div>
  );
}

function mockScrollAreaBounds(element: HTMLElement) {
  Object.defineProperty(element, "getBoundingClientRect", {
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
}

function zoomIn(scrollArea: HTMLElement, count: number) {
  for (let index = 0; index < count; index += 1) {
    fireEvent.wheel(scrollArea, {
      clientY: 240,
      ctrlKey: true,
      deltaY: -120,
    });
  }
}

describe("timeline + detail drawer", () => {
  it("renders safely when no detail payload is selected yet", () => {
    render(
      <div className="grid h-[920px] grid-cols-[minmax(0,1fr)_380px] gap-5">
        <TimelineCanvas
          mode="live"
          onSelectionChange={() => {}}
          projection={null}
          selectedSession={null}
          selection={{ kind: "session" }}
          selectionContext={null}
        />
        <DetailDrawer
          onSelectionChange={() => {}}
          projection={null}
          selectedSession={null}
          selection={{ kind: "session" }}
          selectionContext={null}
        />
      </div>,
    );

    expect(screen.getAllByText("No active session context")).toHaveLength(2);
    expect(screen.getByText("Event detail")).toBeVisible();
  });

  it("reveals tool capsules after diagnostic zoom and syncs item selection into the drawer", () => {
    render(<TimelineHarness mode="live" />);
    const scrollArea = screen.getByTestId("timeline-scroll-area");
    mockScrollAreaBounds(scrollArea);

    expect(
      screen.queryByRole("button", {
        name: "Apply the timeline and drawer wiring patch.",
      }),
    ).not.toBeInTheDocument();

    zoomIn(scrollArea, 2);

    fireEvent.click(screen.getByRole("button", { name: "Apply the timeline and drawer wiring patch." }));

    const drawer = within(screen.getByTestId("timeline-detail-drawer"));

    expect(drawer.getByText("Apply the timeline and drawer wiring patch.")).toBeVisible();
    expect(drawer.getByText("Selection chain")).toBeVisible();
    expect(drawer.getByText("Related items")).toBeVisible();

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

  it("anchors segment selections to the drawer and keeps item detail item-centered", () => {
    render(<TimelineHarness mode="live" />);

    fireEvent.click(screen.getByTestId("timeline-segment-segment:turn:1:2"));

    const drawer = within(screen.getByTestId("timeline-detail-drawer"));

    expect(drawer.getByText("Selection chain")).toBeVisible();
    expect(drawer.getByText("Segment scope")).toBeVisible();
    expect(drawer.getByText("Newton activation")).toBeVisible();
    expect(
      drawer.getAllByText("Worker closed the delegated patch slice and handed results back."),
    ).toHaveLength(2);
  });

  it("summarizes connector selections with source and target flow labels", () => {
    render(<TimelineHarness mode="live" />);

    fireEvent.click(screen.getByTestId("timeline-connector-connector:turn:1:2"));

    const drawer = within(screen.getByTestId("timeline-detail-drawer"));

    expect(drawer.getByText("Complete")).toBeVisible();
    expect(drawer.getByText("Newton -> Main")).toBeVisible();
    expect(drawer.getByText("Complete connector from Newton to Main.")).toBeVisible();
  });

  it("progressively reveals diagnostic and close density content as the user zooms in", () => {
    render(<TimelineHarness mode="live" />);

    const scrollArea = screen.getByTestId("timeline-scroll-area");
    mockScrollAreaBounds(scrollArea);

    expect(
      screen.queryByRole("button", {
        name: "Apply the timeline and drawer wiring patch.",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("update timeline selection source-of-truth in monitor page"),
    ).not.toBeInTheDocument();

    zoomIn(scrollArea, 2);

    expect(
      screen.getByRole("button", {
        name: "Apply the timeline and drawer wiring patch.",
      }),
    ).toBeVisible();
    expect(
      screen.queryByText("update timeline selection source-of-truth in monitor page"),
    ).not.toBeInTheDocument();

    zoomIn(scrollArea, 17);

    expect(
      screen.getByText(
        "features/timeline/ui/* plus page wiring now control selection and latest follow.",
      ),
    ).toBeVisible();
  });

  it("disables latest follow when the user scrubs and restores it with the eye button", () => {
    render(<TimelineHarness mode="live" />);

    const scrollArea = screen.getByTestId("timeline-scroll-area");
    mockScrollAreaBounds(scrollArea);

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
