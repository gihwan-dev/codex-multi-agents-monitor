import { expect, test } from "@playwright/test";

const SHOTS = [
  {
    name: "live-expanded",
    sidebar: "expanded",
    path: "/?demo=ui-qa&tab=live&sidebar=expanded&session=sess-ui-shell",
    text: "Liquid Glass shell redesign",
  },
  {
    name: "live-collapsed",
    sidebar: "collapsed",
    path: "/?demo=ui-qa&tab=live&sidebar=collapsed&session=sess-ui-shell",
    text: "Timeline canvas",
  },
  {
    name: "live-detail-selected",
    sidebar: "expanded",
    path: "/?demo=ui-qa&tab=live&sidebar=expanded&session=sess-archive-flow",
    text: "Archive filter pass",
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

    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath(`${shot.name}.png`),
    });
  });
}

test("sidebar toggle focus and hover capture", async ({ page }, testInfo) => {
  await page.goto("/?demo=ui-qa&tab=live&sidebar=expanded&session=sess-ui-shell", {
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
