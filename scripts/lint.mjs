import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const targetDirs = ["src", "tests", "scripts"];
const issues = [];

function isIgnoredDirectory(name) {
  return name === "node_modules" || name === "dist" || name.startsWith(".");
}

function shouldCheckFile(name) {
  return /\.(ts|tsx|css|md|mjs)$/.test(name);
}

function reportContentIssues(absolutePath, content) {
  const inScriptsDir = absolutePath.includes(`${path.sep}scripts${path.sep}`);

  if (!inScriptsDir && content.includes("console.log(")) {
    issues.push(`${absolutePath}: console.log is not allowed`);
  }
  if (absolutePath.includes(`${path.sep}src${path.sep}`) && content.includes("Hello World")) {
    issues.push(`${absolutePath}: starter copy must be removed`);
  }
  if (/\t/.test(content)) {
    issues.push(`${absolutePath}: tab indentation is not allowed`);
  }
  if (/[ \t]+$/m.test(content)) {
    issues.push(`${absolutePath}: trailing whitespace detected`);
  }
}

function inspectFile(absolutePath) {
  if (!shouldCheckFile(path.basename(absolutePath))) {
    return;
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  reportContentIssues(absolutePath, content);
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (isIgnoredDirectory(entry.name)) {
      continue;
    }

    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath);
      continue;
    }

    inspectFile(absolutePath);
  }
}

function checkMainEntry() {
  const mainEntry = fs.readFileSync(path.join(root, "src/main.tsx"), "utf8");
  if (mainEntry.includes("./styles.css")) {
    issues.push("src/main.tsx: starter styles.css import must be removed");
  }
}

for (const dir of targetDirs) {
  walk(path.join(root, dir));
}

checkMainEntry();

if (issues.length) {
  console.error(issues.join("\n"));
  process.exit(1);
}

console.log("lint checks passed");
