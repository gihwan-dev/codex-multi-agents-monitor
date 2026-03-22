import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { loadRecentSessionSnapshotsForWeb } from "./scripts/sessionSnapshots.mjs";

const host = process.env.TAURI_DEV_HOST;
const sessionSnapshotRoute = "/__codex/session-snapshots.json";

function codexSessionSnapshotPlugin() {
  const handleSnapshotRequest = (
    requestUrl: string | undefined,
    response: {
      statusCode?: number;
      setHeader(name: string, value: string): void;
      end(body: string): void;
    },
    next: () => void,
  ) => {
    if (requestUrl !== sessionSnapshotRoute) {
      next();
      return;
    }

    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(loadRecentSessionSnapshotsForWeb()));
  };

  return {
    name: "codex-session-snapshots",
    configureServer(server: { middlewares: { use: (handler: (req: { url?: string }, res: { statusCode?: number; setHeader(name: string, value: string): void; end(body: string): void }, next: () => void) => void) => void } }) {
      server.middlewares.use((request, response, next) =>
        handleSnapshotRequest(request.url, response, next),
      );
    },
    configurePreviewServer(server: { middlewares: { use: (handler: (req: { url?: string }, res: { statusCode?: number; setHeader(name: string, value: string): void; end(body: string): void }, next: () => void) => void) => void } }) {
      server.middlewares.use((request, response, next) =>
        handleSnapshotRequest(request.url, response, next),
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), codexSessionSnapshotPlugin()],
  base: "./",
  clearScreen: false,
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
