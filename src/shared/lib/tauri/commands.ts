import { invoke } from "@tauri-apps/api/core";

import type {
  HistorySummaryPayload,
  LiveOverviewThread,
  ThreadDetail,
} from "@/shared/types/contracts";

export type TauriCommandErrorCode =
  | "path_not_found"
  | "not_directory"
  | "not_file"
  | "open_failed"
  | "internal";

export type TauriCommandError = {
  code: TauriCommandErrorCode;
  message: string;
  path?: string;
};

export async function listLiveThreads() {
  return invoke<LiveOverviewThread[]>("list_live_threads");
}

export async function getThreadDetail(threadId: string) {
  return invoke<ThreadDetail | null>("get_thread_detail", { threadId });
}

export async function getHistorySummary() {
  return invoke<HistorySummaryPayload>("get_history_summary");
}

export async function openWorkspace(path: string) {
  return invoke<void>("open_workspace", { path });
}

export async function openLogFile(path: string) {
  return invoke<void>("open_log_file", { path });
}
