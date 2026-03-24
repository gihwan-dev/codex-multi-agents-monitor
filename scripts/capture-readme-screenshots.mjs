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
const heroCaptures = [
  { intro: "hero screenshots", name: "hero-default" },
  { intro: "errored subagent graph", label: "Errored subagent", name: "hero-causal-graph" },
  { intro: "dense parallel run", label: "Dense parallel", name: "hero-dense-parallel" },
  { intro: "failed run", label: "First failure", name: "hero-failed-run" },
  { intro: "minimal run", label: "Minimal completed", name: "hero-minimal-run" },
];

function resolveRequestUrl(url) {
  return url === "/" ? "/index.html" : url;
}

function readResponseBody(url) {
  const filePath = join(DIST, resolveRequestUrl(url));
  if (!existsSync(filePath)) {
    return null;
  }

  return {
    body: readFileSync(filePath),
    contentType: MIME[extname(filePath)] || "application/octet-stream",
  };
}

function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const response = readResponseBody(req.url);
      if (!response) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      res.writeHead(200, { "Content-Type": response.contentType });
      res.end(response.body);
    });

    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, url: `http://localhost:${port}` });
    });
  });
}

async function waitForApp(page, baseUrl) {
  await page.goto(baseUrl);
  await page.waitForSelector("text=FIX-002 Waiting chain run", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function clickRunByLabel(page, label) {
  const primaryButton = page.getByRole("button", { name: label });
  if (await primaryButton.count()) {
    await primaryButton.first().click();
    await page.waitForTimeout(800);
    return;
  }

  const fallbackButton = page.locator(`button:has-text("${label}")`);
  if (await fallbackButton.count()) {
    await fallbackButton.first().click();
    await page.waitForTimeout(800);
  }
}

async function capture(page, name) {
  const outputPath = join(OUT, `${name}.png`);
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

function ensureOutputDirectory() {
  if (!existsSync(OUT)) {
    mkdirSync(OUT, { recursive: true });
  }
}

async function captureHeroRuns(page) {
  console.log("\n📸 Capturing hero screenshots...");

  for (const step of heroCaptures) {
    if (step.label) {
      console.log(`\n📸 Capturing ${step.intro}...`);
      await clickRunByLabel(page, step.label);
      await page.waitForTimeout(500);
    }

    await capture(page, step.name);
  }
}

async function captureImportDrawer(page) {
  console.log("\n📸 Capturing import drawer...");

  const importButton = page.getByRole("button", { name: "Import" });
  if (!(await importButton.count())) {
    return;
  }

  await importButton.first().click();
  await page.waitForTimeout(500);
  await capture(page, "feature-import");

  const closeButton = page.getByRole("button", { name: "Close" });
  if (await closeButton.count()) {
    await closeButton.first().click();
  }
}

async function captureInspectorDetail(page) {
  console.log("\n📸 Capturing graph detail...");
  await clickRunByLabel(page, "Errored subagent");
  await page.waitForTimeout(500);

  const eventNode = page.locator("text=Usage limit hit").first();
  if (!(await eventNode.count())) {
    return;
  }

  await eventNode.click();
  await page.waitForTimeout(500);
  await capture(page, "feature-inspector");
}

async function captureDesktopSet(browser, url) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await context.newPage();

  await waitForApp(page, url);
  await captureHeroRuns(page);
  await captureImportDrawer(page);
  await captureInspectorDetail(page);

  await context.close();
}

async function captureMobileView(browser, url) {
  console.log("\n📸 Capturing mobile view...");

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();

  await waitForApp(page, url);
  await capture(page, "mobile-view");
  await context.close();
}

async function main() {
  ensureOutputDirectory();

  const { server, url } = await startServer();
  const browser = await chromium.launch({ headless: true });
  console.log(`Server running at ${url}`);

  try {
    await captureDesktopSet(browser, url);
    await captureMobileView(browser, url);
    console.log("\n✅ All screenshots captured to docs/screenshots/");
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
