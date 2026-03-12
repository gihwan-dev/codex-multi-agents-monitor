import { expect, test } from "@playwright/test";

const SHOTS = [
  {
    name: "live-expanded",
    path: "/?demo=ui-qa&tab=live&sidebar=expanded&session=sess-ui-shell",
    text: "Liquid Glass shell redesign",
  },
  {
    name: "live-collapsed",
    path: "/?demo=ui-qa&tab=live&sidebar=collapsed&session=sess-ui-shell",
    text: "Timeline canvas",
  },
  {
    name: "live-detail-selected",
    path: "/?demo=ui-qa&tab=live&sidebar=expanded&session=sess-archive-flow",
    text: "Archive filter pass",
  },
  {
    name: "archive",
    path: "/?demo=ui-qa&tab=archive&sidebar=expanded&session=sess-archive-flow",
    text: "Replay-ready history",
  },
  {
    name: "metrics",
    path: "/?demo=ui-qa&tab=metrics&sidebar=expanded&session=sess-metrics-audit",
    text: "Workload stays visible without leaving the shell",
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

    const sidebarBorderWidth = await page
      .locator('[data-slot="sidebar-container"]')
      .first()
      .evaluate((node) => getComputedStyle(node as HTMLElement).borderRightWidth);
    expect(sidebarBorderWidth).toBe("0px");

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
