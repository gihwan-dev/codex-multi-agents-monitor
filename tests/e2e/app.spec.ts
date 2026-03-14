import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

function readDistIndex() {
  const indexPath = path.resolve(process.cwd(), "dist/index.html");
  return {
    indexPath,
    html: fs.readFileSync(indexPath, "utf8"),
  };
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
