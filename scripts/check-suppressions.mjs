import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["src", path.join("src-tauri", "src")];
const ignoredFragments = [
  `${path.sep}dist${path.sep}`,
  `${path.sep}storybook-static${path.sep}`,
  `${path.sep}.tmp-tests${path.sep}`,
  `${path.sep}.tmp-quality${path.sep}`,
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}generated${path.sep}`,
  `${path.sep}__fixtures__${path.sep}`,
  `${path.sep}__snapshots__${path.sep}`,
];
const ignoredFiles = new Set([
  path.join(root, "src", "entities", "run", "model", "samples.ts"),
  path.join(root, "src-tauri", "src", "test_support.rs"),
]);
const ignoredSuffixes = [
  ".stories.ts",
  ".stories.tsx",
  ".story.ts",
  ".story.tsx",
];
const broadClippyGroups = [
  "all",
  "cargo",
  "complexity",
  "nursery",
  "pedantic",
  "perf",
  "restriction",
  "style",
];
const checks = [
  { label: "biome-ignore", pattern: /\bbiome-ignore(?:-all)?\b/gm },
  { label: "eslint-disable", pattern: /\beslint-disable\b/gm },
  { label: "@ts-ignore", pattern: /@ts-ignore/gm },
  { label: "@ts-nocheck", pattern: /@ts-nocheck/gm },
  {
    label: "broad clippy allow",
    pattern: new RegExp(
      String.raw`#\s*!?\[\s*allow\s*\(\s*clippy::(?:${broadClippyGroups.join("|")})\s*(?:,|\))`,
      "gm",
    ),
  },
  {
    label: "allow(warnings)",
    pattern: /#\s*!?\[\s*allow\s*\(\s*warnings\s*(?:,|\))/gm,
  },
];
const issues = [];

function shouldSkipPath(absolutePath) {
  if (ignoredFiles.has(absolutePath)) {
    return true;
  }
  if (ignoredSuffixes.some((suffix) => absolutePath.endsWith(suffix))) {
    return true;
  }

  return ignoredFragments.some((fragment) => absolutePath.includes(fragment));
}

function shouldScanFile(absolutePath, entryName) {
  return (
    !shouldSkipPath(absolutePath) &&
    /\.(ts|tsx|js|cjs|mjs|rs)$/.test(entryName) &&
    !entryName.includes(".stories.") &&
    !entryName.includes(".story.")
  );
}

function collectFileIssues(absolutePath) {
  const content = fs.readFileSync(absolutePath, "utf8");

  for (const { label, pattern } of checks) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      issues.push(`${path.relative(root, absolutePath)}: ${label} is not allowed`);
    }
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".github") {
      continue;
    }

    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipPath(absolutePath)) {
        walk(absolutePath);
      }
      continue;
    }

    if (shouldScanFile(absolutePath, entry.name)) {
      collectFileIssues(absolutePath);
    }
  }
}

for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot));
}

if (issues.length > 0) {
  console.error(issues.join("\n"));
  process.exit(1);
}

console.log("suppression audit passed");
