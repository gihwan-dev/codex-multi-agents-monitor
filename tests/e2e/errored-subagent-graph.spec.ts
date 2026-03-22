import fs from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { expect, test } from "@playwright/test";

let distServer: Server | null = null;
let baseUrl = "";

test.beforeAll(async () => {
  const distDir = path.resolve(process.cwd(), "dist");
  distServer = createServer((request, response) => {
    const requestPath =
      request.url && request.url !== "/" ? request.url.split("?")[0] ?? "/index.html" : "/index.html";
    const filePath = path.resolve(distDir, `.${requestPath}`);

    if (!filePath.startsWith(distDir)) {
      response.statusCode = 403;
      response.end("Forbidden");
      return;
    }

    try {
      const body = fs.readFileSync(filePath);
      response.statusCode = 200;
      response.setHeader("Content-Type", contentTypeFor(filePath));
      response.end(body);
    } catch {
      response.statusCode = 404;
      response.end("Not found");
    }
  });

  await new Promise<void>((resolve, reject) => {
    distServer?.listen(0, "127.0.0.1", () => {
      const address = distServer?.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to determine dist server port."));
        return;
      }
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
    distServer?.on("error", reject);
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    distServer?.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

function contentTypeFor(filePath: string) {
  const extension = path.extname(filePath);
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".js") return "application/javascript; charset=utf-8";
  return "text/plain; charset=utf-8";
}

const CAPTURE_DIR = path.resolve(process.cwd(), ".tmp-playwright-captures");

function ensureCaptureDir() {
  if (!fs.existsSync(CAPTURE_DIR)) {
    fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  }
}

test("errored subagent graph: full page and graph panel screenshots", async ({ page }) => {
  ensureCaptureDir();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(baseUrl);
  await expect(page.getByRole("heading", { name: "FIX-002 Waiting chain run" })).toBeVisible();

  // Select the errored subagent session
  const runItem = page.getByRole("treeitem", { name: /만약 니가/i }).first();
  if (await runItem.count() > 0) {
    await runItem.click();
  }
  await page.waitForTimeout(500);

  // Screenshot 1: Full page view
  await page.screenshot({ path: path.join(CAPTURE_DIR, "01-full-page.png") });

  // Screenshot 2: Graph panel only
  const graphPanel = page.locator('[data-slot="graph"]').first();
  if (await graphPanel.count() > 0) {
    await graphPanel.screenshot({ path: path.join(CAPTURE_DIR, "02-graph-panel-top.png") });
  }

  // Screenshot 3: Scroll graph to bottom to see merge edges
  const scrollArea = page.locator('[data-slot="graph-scroll"]').first();
  if (await scrollArea.count() > 0) {
    await scrollArea.evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(300);
    await graphPanel.screenshot({ path: path.join(CAPTURE_DIR, "03-graph-panel-bottom.png") });
  }

  // Screenshot 4: Scroll to middle to see spawn edges connecting to subagent lanes
  if (await scrollArea.count() > 0) {
    await scrollArea.evaluate((el) => el.scrollTo({ top: el.scrollHeight / 3, behavior: "instant" }));
    await page.waitForTimeout(300);
    await graphPanel.screenshot({ path: path.join(CAPTURE_DIR, "04-graph-panel-middle.png") });
  }

  // Verification assertions
  const occupiedCells = page.locator('[data-slot="graph-lane-cell"][data-occupied="true"]');
  expect(await occupiedCells.count()).toBeGreaterThan(0);

  const spawnRoutes = page.locator('[data-slot="graph-route"][data-edge-type="spawn"]');
  expect(await spawnRoutes.count()).toBeGreaterThanOrEqual(3);

  const mergeRoutes = page.locator('[data-slot="graph-route"][data-edge-type="merge"]');
  expect(await mergeRoutes.count()).toBeGreaterThanOrEqual(1);
});

test("errored subagent graph: edge direction validation", async ({ page }) => {
  ensureCaptureDir();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(baseUrl);
  await expect(page.getByRole("heading", { name: "FIX-002 Waiting chain run" })).toBeVisible();

  const runItem = page.getByRole("treeitem", { name: /만약 니가/i }).first();
  if (await runItem.count() > 0) {
    await runItem.click();
  }
  await page.waitForTimeout(500);

  // Get all edge route ports and verify all go downward (source.cy <= target.cy)
  const routeGroups = page.locator('[data-slot="graph-route"]');
  const routeCount = await routeGroups.count();

  for (let i = 0; i < routeCount; i++) {
    const group = routeGroups.nth(i);
    const ports = group.locator('[data-slot="graph-route-port"]');
    const portCount = await ports.count();
    if (portCount < 2) continue;

    const sourcePort = ports.first();
    const targetPort = ports.last();
    const sourceCy = await sourcePort.getAttribute("cy");
    const targetCy = await targetPort.getAttribute("cy");

    if (sourceCy && targetCy) {
      const sourceY = parseFloat(sourceCy);
      const targetY = parseFloat(targetCy);
      // Source should be above or level with target (forward flow)
      expect(sourceY).toBeLessThanOrEqual(targetY + 1); // +1 for float tolerance
    }
  }

  // Take final screenshot showing edge validation passed
  await page.screenshot({ path: path.join(CAPTURE_DIR, "05-edge-direction-validated.png") });
});

test("errored subagent graph: wide view showing all lanes and edges", async ({ page }) => {
  ensureCaptureDir();
  // Very wide viewport to show all 5+ lanes without horizontal scroll
  await page.setViewportSize({ width: 2400, height: 1200 });
  await page.goto(baseUrl);
  await expect(page.getByRole("heading", { name: "FIX-002 Waiting chain run" })).toBeVisible();

  const runItem = page.getByRole("treeitem", { name: /만약 니가/i }).first();
  if (await runItem.count() > 0) {
    await runItem.click();
  }
  await page.waitForTimeout(500);

  // Full wide page screenshot
  await page.screenshot({ path: path.join(CAPTURE_DIR, "06-wide-full.png") });

  // Graph panel wide screenshot - should show ALL lanes and ALL edges
  const graphPanel = page.locator('[data-slot="graph"]').first();
  if (await graphPanel.count() > 0) {
    await graphPanel.screenshot({ path: path.join(CAPTURE_DIR, "07-wide-graph-top.png") });

    // Scroll to middle to see spawn+merge edge connections
    const scrollArea = page.locator('[data-slot="graph-scroll"]').first();
    await scrollArea.evaluate((el) => el.scrollTo({ top: el.scrollHeight / 4, behavior: "instant" }));
    await page.waitForTimeout(200);
    await graphPanel.screenshot({ path: path.join(CAPTURE_DIR, "08-wide-graph-edges.png") });

    // Scroll further to see merge edges back to main thread
    await scrollArea.evaluate((el) => el.scrollTo({ top: el.scrollHeight / 2, behavior: "instant" }));
    await page.waitForTimeout(200);
    await graphPanel.screenshot({ path: path.join(CAPTURE_DIR, "09-wide-graph-merge.png") });

    // Scroll to bottom
    await scrollArea.evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(200);
    await graphPanel.screenshot({ path: path.join(CAPTURE_DIR, "10-wide-graph-bottom.png") });
  }

  // Verify all subagent lane headers are visible
  await expect(page.locator('[data-slot="graph-lane-header"]').filter({ hasText: "Gibbs" })).toBeVisible();
  await expect(page.locator('[data-slot="graph-lane-header"]').filter({ hasText: "Pasteur" })).toBeVisible();
  await expect(page.locator('[data-slot="graph-lane-header"]').filter({ hasText: "Hume" })).toBeVisible();
});
