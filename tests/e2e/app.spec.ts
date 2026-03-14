import fs from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";

let distServer: Server | null = null;
let baseUrl = "";

function readDistIndex() {
  const indexPath = path.resolve(process.cwd(), "dist/index.html");
  return {
    indexPath,
    html: fs.readFileSync(indexPath, "utf8"),
  };
}

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

async function openBuiltApp(page: Page) {
  await page.goto(baseUrl);
  await expect(page.getByRole("heading", { name: "FIX-002 Waiting chain run" })).toBeVisible();
}

function contentTypeFor(filePath: string) {
  const extension = path.extname(filePath);
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".js") return "application/javascript; charset=utf-8";
  return "text/plain; charset=utf-8";
}

test("built app emits relative assets and product title", async () => {
  const { html } = readDistIndex();
  expect(html).toContain("<title>Codex Multi-Agent Monitor</title>");

  const assetMatches = html.match(/\.\/assets\/[^"]+\.(js|css)/g) ?? [];
  expect(assetMatches.length).toBeGreaterThanOrEqual(2);

  for (const asset of assetMatches) {
    const absolute = path.resolve(process.cwd(), "dist", asset.replace("./", ""));
    expect(fs.existsSync(absolute)).toBe(true);
  }
});

test("built bundle contains imported/live contract copy", async () => {
  const { html } = readDistIndex();
  const scriptMatch = html.match(/\.\/assets\/[^"]+\.js/);
  expect(scriptMatch).toBeTruthy();
  if (!scriptMatch?.[0]) {
    throw new Error("built script asset missing");
  }

  const scriptPath = path.resolve(process.cwd(), "dist", scriptMatch[0].replace("./", ""));
  const bundle = fs.readFileSync(scriptPath, "utf8");

  expect(bundle).toContain("Imported run");
  expect(bundle).toContain("Live watch");
  expect(bundle).toContain("Follow live");
  expect(bundle).toContain("Following paused");
});

test("drawer stays hidden until an explicit drawer action", async ({ page }) => {
  await openBuiltApp(page);

  await expect(page.getByRole("heading", { name: "Bottom drawer" })).toHaveCount(0);
  await page.getByRole("main").getByRole("button", { name: "Artifacts" }).click();
  await expect(page.getByRole("heading", { name: "Bottom drawer" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("heading", { name: "Bottom drawer" })).toHaveCount(0);
});

test("mode switches preserve the active run title and inspector selection", async ({ page }) => {
  await openBuiltApp(page);

  await expect(page.getByRole("heading", { name: "Planner blocked" })).toBeVisible();

  for (const mode of ["waterfall", "map", "graph"]) {
    await page.getByRole("button", { name: mode }).click();
    await expect(page.getByRole("heading", { name: "FIX-002 Waiting chain run" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Planner blocked" })).toBeVisible();
  }
});

test("mobile starts with collapsed inspector and preserves selection when reopened", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBuiltApp(page);

  const compactInspector = page.locator(".inspector--compact");
  await expect(compactInspector.getByRole("button", { name: "Open" })).toBeVisible();
  await expect(compactInspector).toContainText("Planner blocked");

  await compactInspector.getByRole("button", { name: "Open" }).click();
  await expect(compactInspector.getByRole("button", { name: "Close" })).toBeVisible();
  await expect(compactInspector).toContainText("Summary");

  await page.keyboard.press("i");
  await expect(compactInspector.getByRole("button", { name: "Open" })).toBeVisible();
  await expect(compactInspector).toContainText("Planner blocked");
});

test("dense parallel run surfaces degradation copy without losing reachability", async ({
  page,
}) => {
  await openBuiltApp(page);

  await page.getByRole("treeitem", { name: /FIX-004 Dense parallel run/i }).click();
  await expect(page.getByRole("heading", { name: "FIX-004 Dense parallel run" })).toBeVisible();
  await expect(
    page.getByText(/inactive done lanes are folded to preserve the active path/i),
  ).toBeVisible();
});
