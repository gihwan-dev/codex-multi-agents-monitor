/**
 * Generate social preview image (1280x640) for GitHub repository.
 * Usage: node scripts/generate-social-preview.mjs
 * Requires: @playwright/test (already in devDependencies)
 */
import { chromium } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, "..", "docs", "social-preview.png");

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1280px; height: 640px;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    color: #f8fafc;
    overflow: hidden;
    position: relative;
  }

  .grid-bg {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(148,163,184,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  .glow {
    position: absolute;
    width: 400px; height: 400px;
    border-radius: 50%;
    filter: blur(120px);
    opacity: 0.15;
  }
  .glow-1 { background: #3b82f6; top: -100px; left: -50px; }
  .glow-2 { background: #8b5cf6; bottom: -100px; right: -50px; }

  .content {
    position: relative; z-index: 1;
    display: flex; flex-direction: column;
    align-items: center; gap: 24px;
    padding: 0 80px;
    text-align: center;
  }

  .icon-row {
    display: flex; gap: 12px; align-items: center;
    margin-bottom: 8px;
  }
  .icon-row span {
    font-size: 14px; font-weight: 600;
    padding: 6px 14px; border-radius: 20px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    color: #94a3b8;
  }

  h1 {
    font-size: 56px; font-weight: 800;
    letter-spacing: -1.5px; line-height: 1.1;
  }
  h1 .highlight {
    background: linear-gradient(90deg, #60a5fa, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .tagline {
    font-size: 22px; color: #94a3b8;
    max-width: 700px; line-height: 1.5;
  }

  .badges {
    display: flex; gap: 10px; margin-top: 8px;
  }
  .badge {
    font-size: 13px; font-weight: 600;
    padding: 6px 16px; border-radius: 8px;
    color: #e2e8f0;
  }
  .badge-tauri { background: rgba(36,200,235,0.15); border: 1px solid rgba(36,200,235,0.3); }
  .badge-react { background: rgba(97,218,251,0.15); border: 1px solid rgba(97,218,251,0.3); }
  .badge-rust { background: rgba(222,165,100,0.15); border: 1px solid rgba(222,165,100,0.3); }
  .badge-ts { background: rgba(49,120,198,0.15); border: 1px solid rgba(49,120,198,0.3); }

  .footer {
    position: absolute; bottom: 32px;
    font-size: 14px; color: #475569;
    z-index: 1;
  }
</style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="glow glow-1"></div>
  <div class="glow glow-2"></div>

  <div class="content">
    <div class="icon-row">
      <span>🔍 Debug</span>
      <span>📊 Visualize</span>
      <span>⚡ Understand</span>
    </div>

    <h1>Codex <span class="highlight">Multi-Agent</span> Monitor</h1>

    <p class="tagline">
      Graph-first desktop workbench for debugging multi-agent runs
      — understand any execution in 30 seconds
    </p>

    <div class="badges">
      <span class="badge badge-tauri">Tauri 2</span>
      <span class="badge badge-react">React 19</span>
      <span class="badge badge-rust">Rust</span>
      <span class="badge badge-ts">TypeScript</span>
    </div>
  </div>

  <div class="footer">github.com/gihwan-dev/codex-multi-agents-monitor</div>
</body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
await page.setContent(html);
await page.screenshot({ path: OUTPUT, type: "png" });
await browser.close();

console.log(`Social preview saved to ${OUTPUT}`);
