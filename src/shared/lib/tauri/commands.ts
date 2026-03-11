import { invoke } from "@tauri-apps/api/core";

import type {
  ArchiveListFilters,
  ArchivedSessionListPayload,
  HistorySummaryPayload,
  LiveOverviewThread,
  SessionFlowPayload,
  SummaryDashboardFilters,
  SummaryDashboardPayload,
  ThreadDetail,
  ThreadDrilldown,
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

export async function listArchivedSessions(filters: ArchiveListFilters = {}) {
  return invoke<ArchivedSessionListPayload>("list_archived_sessions", {
    filters,
  });
}

export async function getThreadDetail(threadId: string) {
  return invoke<ThreadDetail | null>("get_thread_detail", { threadId });
}

export async function getSessionFlow(threadId: string) {
  return invoke<SessionFlowPayload | null>("get_session_flow", { threadId });
}

export async function getThreadDrilldown(threadId: string, laneId: string) {
  return invoke<ThreadDrilldown | null>("get_thread_drilldown", {
    threadId,
    laneId,
  });
}

export async function getHistorySummary() {
  return invoke<HistorySummaryPayload>("get_history_summary");
}

export async function getSummaryDashboard(
  filters: SummaryDashboardFilters = {},
) {
  return invoke<SummaryDashboardPayload>("get_summary_dashboard", {
    filters,
  });
}

export async function openWorkspace(path: string) {
  return invoke<void>("open_workspace", { path });
}

export async function openLogFile(path: string) {
  return invoke<void>("open_log_file", { path });
}
