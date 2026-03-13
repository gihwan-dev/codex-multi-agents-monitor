import { expect, test } from "@playwright/test";

const SHOTS = [
  {
    name: "live-expanded",
    sidebar: "expanded",
    path: "/?demo=ui-qa&tab=live&sidebar=expanded&session=sess-ui-shell&summary=expanded&drawer=open",
    text: "Liquid Glass shell redesign",
  },
  {
    name: "live-summary-collapsed",
    sidebar: "expanded",
    path: "/?demo=ui-qa&tab=live&sidebar=expanded&session=sess-ui-shell&summary=collapsed&drawer=open",
    text: "Sequence timeline",
  },
  {
    name: "live-drawer-closed",
    sidebar: "expanded",
    path: "/?demo=ui-qa&tab=live&sidebar=expanded&session=sess-ui-shell&summary=expanded&drawer=closed",
    text: "Liquid Glass shell redesign",
  },
  {
    name: "live-detail-selected",
    sidebar: "expanded",
    path: "/?demo=ui-qa&tab=live&sidebar=expanded&session=sess-ui-shell&summary=expanded&drawer=open",
    text: "Liquid Glass shell redesign",
  },
  {
    name: "live-long-title",
    sidebar: "expanded",
    path: "/?demo=ui-qa&tab=live&sidebar=expanded&session=sess-live-noisy-title&summary=expanded&drawer=open",
    text: "제목이 이상하게 캡쳐됨.",
  },
  {
    name: "live-sidebar-collapsed",
    sidebar: "collapsed",
    path: "/?demo=ui-qa&tab=live&sidebar=collapsed&session=sess-ui-shell&summary=expanded&drawer=open",
    text: "Sequence timeline",
  },
  {
    name: "archive",
    sidebar: "expanded",
    path: "/?demo=ui-qa&tab=archive&sidebar=expanded&session=sess-archive-flow",
    text: "Session archive",
  },
  {
    name: "metrics",
    sidebar: "expanded",
    path: "/?demo=ui-qa&tab=metrics&sidebar=expanded&session=sess-metrics-audit",
    text: "Agent utilization",
  },
];

for (const shot of SHOTS) {
  test(`${shot.name} desktop capture`, async ({ page }, testInfo) => {
    await page.goto(shot.path, { waitUntil: "networkidle" });

    await expect(page.locator("[data-monitor-shell]")).toHaveAttribute(
      "data-ui-qa-mode",
      "true",
    );
    await expect(page.locator("main").getByText(shot.text).first()).toBeVisible();

    const sidebarContainer = page.locator('[data-slot="sidebar-container"]');

    if (shot.sidebar === "collapsed") {
      await expect(sidebarContainer).toHaveCount(0);
    } else {
      const sidebarBorderWidth = await sidebarContainer
        .first()
        .evaluate((node) => getComputedStyle(node as HTMLElement).borderRightWidth);
      expect(sidebarBorderWidth).toBe("0px");
    }

    if (shot.name.startsWith("live-")) {
      await expect(page.getByTestId("live-session-summary")).toBeVisible();
      await expect(page.getByTestId("live-timeline-stage")).toBeVisible();
      await expect(page.getByTestId("timeline-scroll-area")).toBeVisible();
    }

    if (shot.name === "live-expanded") {
      const layout = await page.evaluate(() => {
        const stage = document.querySelector('[data-testid="live-timeline-stage"]');
        const scrollArea = document.querySelector('[data-testid="timeline-scroll-area"]');
        const drawerShell = document.querySelector('[data-testid="timeline-detail-floating-shell"]');
        const liveContent = document.querySelector('[data-testid="live-workspace-content"]');

        return {
          drawerHeight: drawerShell?.getBoundingClientRect().height ?? 0,
          liveContentHeight: liveContent?.getBoundingClientRect().height ?? 0,
          stageHeight: stage?.getBoundingClientRect().height ?? 0,
          stageWidth: stage?.getBoundingClientRect().width ?? 0,
          scrollWidth: scrollArea?.getBoundingClientRect().width ?? 0,
        };
      });

      expect(layout.liveContentHeight).toBeGreaterThan(0);
      expect(layout.drawerHeight / layout.liveContentHeight).toBeGreaterThan(0.98);
      expect(layout.stageWidth).toBeGreaterThan(0);
      expect(layout.scrollWidth / layout.stageWidth).toBeGreaterThan(0.9);
      await expect(page.getByTestId("timeline-detail-floating-shell")).toHaveAttribute(
        "data-state",
        "open",
      );
      await expect(page.getByTestId("timeline-detail-drawer")).toBeVisible();
    }

    if (shot.name === "live-summary-collapsed") {
      await expect(page.getByTestId("live-session-summary")).toHaveAttribute(
        "data-state",
        "collapsed",
      );
      const summaryHeight = await page
        .getByTestId("live-session-summary")
        .evaluate((node) => node.getBoundingClientRect().height);
      expect(summaryHeight).toBeLessThan(80);
      await expect(page.getByText("Selected session")).toBeHidden();
    }

    if (shot.name === "live-drawer-closed") {
      await expect(page.getByTestId("timeline-detail-floating-shell")).toHaveAttribute(
        "data-state",
        "closed",
      );
      await expect(page.getByTestId("timeline-detail-drawer-handle")).toBeVisible();
      await expect(page.getByTestId("timeline-detail-drawer")).toBeHidden();
    }

    if (shot.name === "live-detail-selected") {
      await page
        .getByRole("button", {
          name: "Main integrated the worker patch into the live monitor shell.",
        })
        .click();
      await expect(
        page.getByText("Main integrated the worker patch into the live monitor shell.").nth(1),
      ).toBeVisible();
      await expect(page.getByText("Selection chain")).toBeVisible();
    }

    if (
      shot.name === "live-long-title" ||
      shot.name === "live-sidebar-collapsed"
    ) {
      await expect(page.getByTestId("timeline-detail-drawer")).toBeVisible();
    }

    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath(`${shot.name}.png`),
    });
  });
}

test("sidebar toggle focus and hover capture", async ({ page }, testInfo) => {
  await page.goto("/?demo=ui-qa&tab=live&sidebar=expanded&session=sess-ui-shell&summary=expanded&drawer=open", {
    waitUntil: "networkidle",
  });

  const toggle = page.locator('[data-sidebar="trigger"]');
  await toggle.focus();
  await toggle.hover();
  await expect(toggle).toBeVisible();

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("sidebar-toggle-focus.png"),
  });
});
