import { deriveArchiveIndexTitle } from "../../../entities/session-log";
import type { MonitorState } from "./state";
import { describeSelectionLoadState } from "./state/selectionLoadState";

export { buildSelectionRevealTarget } from "./selectionRevealTarget";

interface SelectionLoadingPresentation {
  title: string;
  message: string;
  phaseLabel: string;
  targetEyebrow?: string;
  targetTitle?: string;
  targetMeta?: string;
}

export function resolveActiveSessionFilePath(state: MonitorState) {
  if (state.selectionLoadState?.filePath) {
    return state.selectionLoadState.filePath;
  }

  return (
    Object.entries(state.hydratedDatasetsByFilePath).find(
      ([, dataset]) => dataset.run.traceId === state.activeRunId,
    )?.[0] ?? null
  );
}

function fallbackLoadingTitleFromFilePath(filePath: string | null) {
  if (!filePath) {
    return undefined;
  }

  const segments = filePath.split("/").filter(Boolean);
  const normalized = segments[segments.length - 1] ?? filePath;
  return normalized.replace(/\.(json|jsonl)$/i, "");
}

function getSelectionTargetEyebrow(source: "archived" | "recent") {
  return source === "archived" ? "Archived session" : "Recent session";
}

function resolveRecentSelectionLoadTarget(state: MonitorState, filePath: string) {
  const recentItem = state.recentIndex.find((item) => item.filePath === filePath) ?? null;
  if (!recentItem) {
    return null;
  }

  return {
    targetEyebrow: "Recent session",
    targetTitle: recentItem.title,
    targetMeta: recentItem.displayName,
  };
}

function resolveArchivedSelectionLoadTarget(state: MonitorState, filePath: string) {
  const archivedItem =
    state.archivedIndex.find((item) => item.filePath === filePath) ?? null;
  if (!archivedItem) {
    return null;
  }

  return {
    targetEyebrow: "Archived session",
    targetTitle:
      deriveArchiveIndexTitle(archivedItem.firstUserMessage) ??
      fallbackLoadingTitleFromFilePath(archivedItem.filePath) ??
      archivedItem.sessionId,
    targetMeta: archivedItem.displayName,
  };
}

function resolveIndexedSelectionLoadTarget(state: MonitorState, filePath: string) {
  const loadState = state.selectionLoadState;
  if (!loadState) {
    return null;
  }

  return loadState.source === "recent"
    ? resolveRecentSelectionLoadTarget(state, filePath)
    : resolveArchivedSelectionLoadTarget(state, filePath);
}

function resolveHydratedSelectionLoadTarget(state: MonitorState, filePath: string) {
  const loadState = state.selectionLoadState;
  const hydratedDataset = state.hydratedDatasetsByFilePath[filePath] ?? null;
  if (!loadState || !hydratedDataset) {
    return null;
  }

  return {
    targetEyebrow: getSelectionTargetEyebrow(loadState.source),
    targetTitle: hydratedDataset.run.title,
    targetMeta: hydratedDataset.project.name,
  };
}

function buildFallbackSelectionLoadTarget(state: MonitorState, filePath: string) {
  const loadState = state.selectionLoadState;
  if (!loadState) {
    return null;
  }

  return {
    targetEyebrow: getSelectionTargetEyebrow(loadState.source),
    targetTitle: fallbackLoadingTitleFromFilePath(filePath),
  };
}

function resolveSelectionLoadingContext(state: MonitorState) {
  const selectionLoadState = state.selectionLoadState;
  const filePath = selectionLoadState?.filePath;
  if (!selectionLoadState || !filePath) {
    return null;
  }

  return { filePath, selectionLoadState };
}

function resolveSelectionLoadingTarget(state: MonitorState, filePath: string) {
  return (
    resolveIndexedSelectionLoadTarget(state, filePath) ??
    resolveHydratedSelectionLoadTarget(state, filePath) ??
    buildFallbackSelectionLoadTarget(state, filePath)
  );
}

export function createSelectionLoadingPresentation(
  state: MonitorState,
): SelectionLoadingPresentation | null {
  const context = resolveSelectionLoadingContext(state);
  if (!context) {
    return null;
  }

  const loadingDescription = describeSelectionLoadState(context.selectionLoadState);
  if (!loadingDescription) {
    return null;
  }

  return {
    ...loadingDescription,
    ...(resolveSelectionLoadingTarget(state, context.filePath) ?? {}),
  };
}
