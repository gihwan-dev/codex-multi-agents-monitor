import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiquidGlassProvider } from "@/app/ui";
import { DemoMonitorPage } from "@/pages/monitor";
import { createQueryClientWrapper } from "@/test/query-client";

import { resolveMonitorUiQaState } from "../lib/ui-qa-fixtures";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function installMatchMedia(width: number) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => {
      const maxWidth = /max-width:\s*(\d+)px/.exec(query);
      const minWidth = /min-width:\s*(\d+)px/.exec(query);
      const matches =
        (maxWidth ? width <= Number(maxWidth[1]) : true) &&
        (minWidth ? width >= Number(minWidth[1]) : true);

      return {
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      };
    }),
  });
}

function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
    writable: true,
  });
  installMatchMedia(width);
  window.dispatchEvent(new Event("resize"));
}

function renderDemoMonitor(search: string, width: number) {
  setViewport(width);
  const uiQaState = resolveMonitorUiQaState(search);

  if (!uiQaState) {
    throw new Error("Expected UI-QA state");
  }

  return render(
    <LiquidGlassProvider>
      <DemoMonitorPage uiQaState={uiQaState} />
    </LiquidGlassProvider>,
    {
      wrapper: createQueryClientWrapper(),
    },
  );
}

beforeEach(() => {
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: ResizeObserverMock,
  });
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
  setViewport(1440);
});

afterEach(() => {
  cleanup();
});

describe("MonitorPage live layout", () => {
  it("keeps the drawer floating on wide desktop and reopens it from the edge handle", async () => {
    renderDemoMonitor(
      "?demo=ui-qa&tab=live&session=sess-ui-shell&drawer=closed",
      1440,
    );

    const stage = await screen.findByTestId("live-timeline-stage");
    const floatingShell = screen.getByTestId("timeline-detail-floating-shell");

    expect(stage).toHaveAttribute("data-drawer-mode", "floating-closed");
    expect(floatingShell).toHaveAttribute("data-state", "closed");
    expect(screen.getByTestId("timeline-detail-drawer-handle")).toBeVisible();

    fireEvent.click(screen.getByTestId("timeline-detail-drawer-handle"));

    await waitFor(() => {
      expect(floatingShell).toHaveAttribute("data-state", "open");
    });
    expect(screen.getByTestId("timeline-detail-drawer")).toBeVisible();

    fireEvent.click(screen.getByTestId("timeline-detail-drawer-close"));

    await waitFor(() => {
      expect(floatingShell).toHaveAttribute("data-state", "closed");
    });
  });

  it("falls back to the stacked drawer below xl even when the initial drawer state is closed", async () => {
    renderDemoMonitor(
      "?demo=ui-qa&tab=live&session=sess-ui-shell&drawer=closed",
      1100,
    );

    const stage = await screen.findByTestId("live-timeline-stage");

    expect(stage).toHaveAttribute("data-drawer-mode", "stacked");
    expect(screen.queryByTestId("timeline-detail-floating-shell")).not.toBeInTheDocument();
    expect(screen.getByTestId("timeline-detail-drawer")).toBeVisible();
  });
});
