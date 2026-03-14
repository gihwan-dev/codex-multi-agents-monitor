import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const targetDirs = ["src", "tests", "scripts"];
const issues = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) {
      continue;
    }
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolute);
      continue;
    }
    if (!/\.(ts|tsx|css|md|mjs)$/.test(entry.name)) {
      continue;
    }
    const content = fs.readFileSync(absolute, "utf8");
    const inScriptsDir = absolute.includes(`${path.sep}scripts${path.sep}`);
    if (!inScriptsDir && content.includes("console.log(")) {
      issues.push(`${absolute}: console.log is not allowed`);
    }
    if (absolute.includes(`${path.sep}src${path.sep}`) && content.includes("Hello World")) {
      issues.push(`${absolute}: starter copy must be removed`);
    }
    if (/\t/.test(content)) {
      issues.push(`${absolute}: tab indentation is not allowed`);
    }
    if (/[ \t]+$/m.test(content)) {
      issues.push(`${absolute}: trailing whitespace detected`);
    }
  }
}

for (const dir of targetDirs) {
  walk(path.join(root, dir));
}

const mainEntry = fs.readFileSync(path.join(root, "src/main.tsx"), "utf8");
if (mainEntry.includes("./styles.css")) {
  issues.push("src/main.tsx: starter styles.css import must be removed");
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exit(1);
}

console.log("lint checks passed");
