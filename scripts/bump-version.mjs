#!/usr/bin/env node

/**
 * Synchronize version across package.json, tauri.conf.json, and Cargo.toml.
 * Usage: node scripts/bump-version.mjs <version>
 * Example: node scripts/bump-version.mjs 0.2.0
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const version = process.argv[2];
if (!version) {
  console.error("Usage: node scripts/bump-version.mjs <version>");
  console.error("Example: node scripts/bump-version.mjs 0.2.0");
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`Invalid semver: ${version}`);
  process.exit(1);
}

const files = [
  {
    path: resolve(root, "package.json"),
    update(content) {
      const json = JSON.parse(content);
      json.version = version;
      return JSON.stringify(json, null, 2) + "\n";
    },
  },
  {
    path: resolve(root, "src-tauri/tauri.conf.json"),
    update(content) {
      const json = JSON.parse(content);
      json.version = version;
      return JSON.stringify(json, null, 2) + "\n";
    },
  },
  {
    path: resolve(root, "src-tauri/Cargo.toml"),
    update(content) {
      return content.replace(
        /^version\s*=\s*"[^"]*"/m,
        `version = "${version}"`,
      );
    },
  },
];

for (const file of files) {
  const content = readFileSync(file.path, "utf-8");
  const updated = file.update(content);
  writeFileSync(file.path, updated, "utf-8");
  console.log(`Updated ${file.path}`);
}

console.log(`\nVersion bumped to ${version}`);
console.log("\nNext steps:");
console.log(`  git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml`);
console.log(`  git commit -m "chore: prepare v${version} release"`);
console.log(`  git tag v${version}`);
console.log(`  git push origin main --tags`);
