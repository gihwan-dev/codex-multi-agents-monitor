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

test("left rail uses a simplified workspace to run tree", async ({ page }) => {
  await openBuiltApp(page);

  const rail = page.locator(".workspace__rail");
  await expect(rail.getByPlaceholder("Search workspaces and runs")).toBeVisible();
  await expect(rail.getByRole("button", { name: "Import" })).toBeVisible();

  await expect(rail.getByRole("button", { name: "All" })).toHaveCount(0);
  await expect(rail.getByRole("button", { name: "Live" })).toHaveCount(0);
  await expect(rail.getByText("FIX-002 Waiting chain run", { exact: true })).toHaveCount(0);
  await expect(rail.getByText(/\bago\b/i)).toHaveCount(0);

  const runTreeItem = rail.getByRole("treeitem", { name: /Waiting chain review/i });
  await expect(runTreeItem).toBeVisible();
  await expect(runTreeItem).toContainText("Waiting");
  await expect(runTreeItem).not.toContainText("Imported");
  await expect(runTreeItem).not.toContainText("Spec approval missing");
});

test("left rail preserves hierarchy and single-line run titles", async ({ page }) => {
  await openBuiltApp(page);

  const rail = page.locator(".workspace__rail");
  const workspaceLabel = rail.locator(".run-list__workspace-copy strong").first();
  const runTitle = rail.locator(".run-row__title strong").first();
  const tree = rail.locator(".run-list__tree");

  const workspaceFontSize = await workspaceLabel.evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).fontSize),
  );
  const runFontSize = await runTitle.evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).fontSize),
  );
  const runTitleStyles = await runTitle.evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      overflow: styles.overflow,
      textOverflow: styles.textOverflow,
      whiteSpace: styles.whiteSpace,
    };
  });
  const treeAlignContent = await tree.evaluate((element) => window.getComputedStyle(element).alignContent);

  expect(runFontSize).toBeGreaterThan(workspaceFontSize);
  expect(runTitleStyles).toEqual({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  });
  expect(treeAlignContent).toBe("start");
});

test("rail and inspector resize beyond the previous width caps", async ({ page }) => {
  await openBuiltApp(page);

  const railHandle = page.getByRole("separator", { name: "Resize run list" });
  await railHandle.focus();
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("ArrowRight");
  }

  await expect
    .poll(() =>
      page.locator(".workspace__rail").evaluate((element) => {
        const width = (element as HTMLElement).style.width;
        return Number.parseFloat(width);
      }),
    )
    .toBeGreaterThan(340);

  const inspectorHandle = page.getByRole("separator", { name: "Resize inspector" });
  await inspectorHandle.focus();
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("ArrowLeft");
  }

  await expect
    .poll(() =>
      page.locator(".workspace__inspector").evaluate((element) => {
        const width = (element as HTMLElement).style.width;
        return Number.parseFloat(width);
      }),
    )
    .toBeGreaterThan(380);
});

test("drawer stays hidden until an explicit drawer action", async ({ page }) => {
  await openBuiltApp(page);

  await expect(page.getByRole("heading", { name: "Bottom drawer" })).toHaveCount(0);
  await page.locator("aside.workspace__inspector").getByRole("button", { name: "Artifacts" }).click();
  await expect(page.getByRole("heading", { name: "Bottom drawer" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("heading", { name: "Bottom drawer" })).toHaveCount(0);
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

  await page.locator('.run-row[title="Dense parallel replay"]').click();
  await expect(page.getByRole("heading", { name: "FIX-004 Dense parallel run" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lane 9 step 10" })).toBeVisible();
});
