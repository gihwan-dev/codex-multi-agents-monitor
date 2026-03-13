export type {
  LiveSessionUpdate,
  SessionSummary,
  WorkspaceSessionGroup,
  WorkspaceSessionsSnapshot,
} from "@/shared/queries";
export {
  compareRefreshMarkers,
  compareSessionSummary,
  findSelectedSession,
  firstSessionId,
  mergeBootstrapSnapshot,
  pruneLiveSnapshot,
  selectLiveWorkspaceSnapshot,
  sortSnapshot,
  sortWorkspaceGroup,
  upsertLiveSummary,
  upsertSessionSummary,
} from "./lib/snapshot";
export {
  formatSessionDisplayTitle,
  formatTime,
  normalizeSessionTitle,
  formatTimestamp,
  formatWorkspaceLabel,
  statusBadgeVariant,
} from "./lib/presentation";
export { SessionBadges } from "./ui/session-badges";
