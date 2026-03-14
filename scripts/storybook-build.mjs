import fs from "node:fs";
import path from "node:path";

const outputDir = path.join(process.cwd(), "storybook-static");
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const stories = ["App/MonitorApp"];
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Monitor Stories</title>
    <style>
      body { font-family: "IBM Plex Sans", sans-serif; background:#0f1115; color:#f3f6fb; padding:24px; }
      .story { border:1px solid rgba(255,255,255,0.12); border-radius:16px; padding:16px; margin-bottom:12px; background:#141821; }
      .story code { color:#67e8f9; }
    </style>
  </head>
  <body>
    <h1>Static story showcase</h1>
    <p>Offline fallback for Storybook build. Replace with real Storybook when registry access is restored.</p>
    ${stories
      .map(
        (story) => `<article class="story"><h2>${story}</h2><p>Primary workbench shell story is registered in <code>src/app/MonitorApp.stories.tsx</code>.</p></article>`,
      )
      .join("")}
  </body>
</html>`;

fs.writeFileSync(path.join(outputDir, "index.html"), html);
console.log("storybook static showcase written");
