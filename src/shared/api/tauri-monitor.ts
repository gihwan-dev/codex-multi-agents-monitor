import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  LiveSessionUpdate,
  SessionDetailQuery,
  SessionDetailSnapshot,
  WorkspaceSessionsSnapshot,
} from "@/shared/queries";

export const LIVE_SESSION_UPDATED_EVENT = "codex://live-session-updated";

export function isTauriRuntimeAvailable() {
  const runtime = globalThis as typeof globalThis & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };

  return runtime.__TAURI__ !== undefined || runtime.__TAURI_INTERNALS__ !== undefined;
}

export function queryWorkspaceSessions() {
  return invoke<WorkspaceSessionsSnapshot>("query_workspace_sessions");
}

export function queryWorkspaceSessionsCached() {
  return invoke<WorkspaceSessionsSnapshot>("query_workspace_sessions_cached");
}

export function querySessionDetail(query: SessionDetailQuery) {
  return invoke<SessionDetailSnapshot>("query_session_detail", { query });
}

export function startLiveBridge() {
  return invoke<void>("start_live_bridge");
}

export function listenToLiveSessionUpdates(
  onUpdate: (update: LiveSessionUpdate) => void,
) {
  return listen<LiveSessionUpdate>(LIVE_SESSION_UPDATED_EVENT, (event) => {
    onUpdate(event.payload);
  }) as Promise<UnlistenFn>;
}
