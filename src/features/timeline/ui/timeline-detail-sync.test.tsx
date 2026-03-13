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

  it("renders turn headers and syncs visible item selection into the drawer", () => {
    render(<TimelineHarness mode="live" />);
    const scrollArea = screen.getByTestId("timeline-scroll-area");
    mockScrollAreaBounds(scrollArea);

    expect(screen.getByTestId("timeline-turn-header-turn:2")).toHaveTextContent(
      "Now make the relationships readable at a glance.",
    );
    expect(screen.getByText("+1m idle gap")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Main integrated the worker patch into the live monitor shell.",
      }),
    );

    const drawer = within(screen.getByTestId("timeline-detail-drawer"));

    expect(
      drawer.getAllByText("Main integrated the worker patch into the live monitor shell."),
    ).toHaveLength(2);
    expect(drawer.getByText("Selection chain")).toBeVisible();
    expect(drawer.getByText("Related items")).toBeVisible();

    fireEvent.click(drawer.getByRole("tab", { name: "Input-Output" }));

    expect(
      drawer.getByText(
        "Sequence stage and drawer selection state are back under the main lane before the next user turn.",
      ),
    ).toBeVisible();
    expect(
      drawer.getByText("No output preview available for the current selection."),
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

  it("keeps tool capsules off the live stage and reserves space for turn headers", () => {
    render(<TimelineHarness mode="live" />);

    expect(
      screen.queryByRole("button", { name: "Apply the timeline and drawer wiring patch." }),
    ).not.toBeInTheDocument();

    const headerRow = screen.getByTestId("timeline-turn-header-row-turn:1");
    const firstVisibleItem = screen.getByTestId("timeline-item-evt-spawn");

    expect(parseFloat(firstVisibleItem.style.top)).toBeGreaterThan(
      parseFloat(headerRow.style.top) + 52,
    );
  });

  it("disables latest follow when the user scrubs and restores it with the eye button", async () => {
    render(<TimelineHarness mode="live" />);

    const scrollArea = screen.getByTestId("timeline-scroll-area");
    mockScrollAreaBounds(scrollArea);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    scrollArea.scrollTop = 120;
    fireEvent.scroll(scrollArea);

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

  it("keeps live ctrl+wheel from switching into zoom mode", () => {
    render(<TimelineHarness mode="live" />);

    const scrollArea = screen.getByTestId("timeline-scroll-area");
    mockScrollAreaBounds(scrollArea);
    const beforeScrollTop = scrollArea.scrollTop;

    fireEvent.wheel(scrollArea, {
      clientY: 240,
      ctrlKey: true,
      deltaY: -120,
    });

    expect(screen.getByTestId("timeline-follow-state")).toHaveTextContent("Following latest");
    expect(scrollArea.scrollTop).toBe(beforeScrollTop);
  });

  it("switches to manual review when the user scrolls the timeline", async () => {
    render(<TimelineHarness mode="live" />);

    const scrollArea = screen.getByTestId("timeline-scroll-area");

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    scrollArea.scrollTop = 120;

    expect(() => {
      fireEvent.scroll(scrollArea);
    }).not.toThrow();

    expect(screen.getByTestId("timeline-follow-state")).toHaveTextContent("Manual review");
    expect(screen.getByTestId("timeline-refollow-button")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("starts live mode pinned to the latest internal timeline position", async () => {
    render(<TimelineHarness mode="live" />);

    const scrollArea = screen.getByTestId("timeline-scroll-area");

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    expect(scrollArea.scrollTop).toBeGreaterThan(0);
    expect(scrollArea).toHaveAttribute("data-follow-latest", "true");
  });

  it("uses the archive preset without exposing the live follow control", () => {
    render(<TimelineHarness mode="archive" />);

    expect(screen.getByTestId("timeline-follow-state")).toHaveTextContent("Archive fit");
    expect(screen.queryByTestId("timeline-refollow-button")).not.toBeInTheDocument();
  });
});
