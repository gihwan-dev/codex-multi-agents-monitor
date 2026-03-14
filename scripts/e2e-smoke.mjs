import fs from "node:fs";
import path from "node:path";

const distDir = path.join(process.cwd(), "dist");
const indexFile = path.join(distDir, "index.html");

if (!fs.existsSync(indexFile)) {
  console.error("dist/index.html not found. Run pnpm build first.");
  process.exit(1);
}

const html = fs.readFileSync(indexFile, "utf8");

if (!html.includes('id="root"')) {
  console.error("root mount point missing in built page");
  process.exit(1);
}

const assetMatch = html.match(/assets\/[^"]+\.(js|css)/g);
if (!assetMatch?.length) {
  console.error("vite asset reference missing in built page");
  process.exit(1);
}

for (const asset of assetMatch) {
  if (!fs.existsSync(path.join(distDir, asset))) {
    console.error(`missing built asset: ${asset}`);
    process.exit(1);
  }
}

console.log("e2e smoke passed");
