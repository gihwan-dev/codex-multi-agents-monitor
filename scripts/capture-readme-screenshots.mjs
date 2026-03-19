/**
 * README용 고품질 스크린샷 캡처 스크립트
 * 27인치 모니터 해상도 (2560x1440) 기준
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { chromium } from "@playwright/test";

const DIST = join(import.meta.dirname, "..", "dist");
const OUT = join(import.meta.dirname, "..", "docs", "screenshots");
const VIEWPORT = { width: 2560, height: 1440 };

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = req.url === "/" ? "/index.html" : req.url;
      const filePath = join(DIST, url);
      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(readFileSync(filePath));
    });
    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, url: `http://localhost:${port}` });
    });
  });
}

async function waitForApp(page, baseUrl) {
  await page.goto(baseUrl);
  // Wait for the app to fully render with fixture data
  await page.waitForSelector("text=FIX-002 Waiting chain run", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function clickRunByLabel(page, label) {
  const btn = page.getByRole("button", { name: label });
  if (await btn.count()) {
    await btn.first().click();
    await page.waitForTimeout(800);
  } else {
    // Try text match
    const el = page.locator(`button:has-text("${label}")`);
    if (await el.count()) {
      await el.first().click();
      await page.waitForTimeout(800);
    }
  }
}

async function capture(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

  const { server, url } = await startServer();
  console.log(`Server running at ${url}`);

  const browser = await chromium.launch({ headless: true });

  try {
    // === 1. Hero shot: Default 3-pane layout (Waiting chain run) ===
    console.log("\n📸 Capturing hero screenshots...");
    const ctx1 = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
    const page1 = await ctx1.newPage();
    await waitForApp(page1, url);
    await capture(page1, "hero-default");

    // === 2. Errored subagent graph (FIX-007) ===
    console.log("\n📸 Capturing errored subagent graph...");
    await clickRunByLabel(page1, "Errored subagent");
    await page1.waitForTimeout(500);
    await capture(page1, "hero-causal-graph");

    // === 3. Dense parallel run (FIX-004) ===
    console.log("\n📸 Capturing dense parallel run...");
    await clickRunByLabel(page1, "Dense parallel");
    await page1.waitForTimeout(500);
    await capture(page1, "hero-dense-parallel");

    // === 4. Failed run (FIX-003) ===
    console.log("\n📸 Capturing failed run...");
    await clickRunByLabel(page1, "First failure");
    await page1.waitForTimeout(500);
    await capture(page1, "hero-failed-run");

    // === 5. Minimal completed run (FIX-001) ===
    console.log("\n📸 Capturing minimal run...");
    await clickRunByLabel(page1, "Minimal completed");
    await page1.waitForTimeout(500);
    await capture(page1, "hero-minimal-run");

    // === 6. Import drawer ===
    console.log("\n📸 Capturing import drawer...");
    const importBtn = page1.getByRole("button", { name: "Import" });
    if (await importBtn.count()) {
      await importBtn.first().click();
      await page1.waitForTimeout(500);
      await capture(page1, "feature-import");
      // Close drawer
      const closeBtn = page1.getByRole("button", { name: "Close" });
      if (await closeBtn.count()) await closeBtn.first().click();
    }

    // === 7. Go back to FIX-007 errored run for the best graph ===
    console.log("\n📸 Capturing graph detail...");
    await clickRunByLabel(page1, "Errored subagent");
    await page1.waitForTimeout(500);

    // Click on an event node to show inspector detail
    const eventNode = page1.locator("text=Usage limit hit").first();
    if (await eventNode.count()) {
      await eventNode.click();
      await page1.waitForTimeout(500);
      await capture(page1, "feature-inspector");
    }

    await ctx1.close();

    // === 8. Mobile view ===
    console.log("\n📸 Capturing mobile view...");
    const ctx2 = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
    });
    const page2 = await ctx2.newPage();
    await page2.goto(url);
    await waitForApp(page2, url);
    await capture(page2, "mobile-view");
    await ctx2.close();

    console.log("\n✅ All screenshots captured to docs/screenshots/");
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
