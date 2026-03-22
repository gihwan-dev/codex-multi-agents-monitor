import { buildDatasetActivationPatch, upsertDataset } from "./helpers";
import type { MonitorState } from "./types";

export function beginArchivedIndexRequest(state: MonitorState, requestId: number): MonitorState {
  return {
    ...state,
    archivedIndexLoading: true,
    archivedIndexError: null,
    archivedIndexRequestId: requestId,
  };
}

export function resolveArchivedIndexRequest(
  state: MonitorState,
  requestId: number,
  result: MonitorState["archivedIndex"] extends Array<infer _> ? {
    items: MonitorState["archivedIndex"];
    total: number;
    hasMore: boolean;
  } : never,
  append: boolean,
): MonitorState {
  if (requestId !== state.archivedIndexRequestId) {
    return state;
  }

  return {
    ...state,
    archivedIndex: append ? [...state.archivedIndex, ...result.items] : result.items,
    archivedTotal: result.total,
    archivedHasMore: result.hasMore,
    archivedIndexLoading: false,
    archivedIndexError: null,
  };
}

export function finishArchivedIndexRequest(
  state: MonitorState,
  requestId: number,
  error?: string | null,
): MonitorState {
  if (requestId !== state.archivedIndexRequestId) {
    return state;
  }

  return {
    ...state,
    archivedIndex: error ? [] : state.archivedIndex,
    archivedTotal: error ? 0 : state.archivedTotal,
    archivedHasMore: error ? false : state.archivedHasMore,
    archivedIndexLoading: false,
    archivedIndexError: error ?? null,
  };
}

export function beginArchivedSnapshotRequest(
  state: MonitorState,
  requestId: number,
): MonitorState {
  return {
    ...state,
    archivedSnapshotLoading: true,
    archivedSnapshotRequestId: requestId,
  };
}

export function resolveArchivedSnapshotRequest(
  state: MonitorState,
  requestId: number,
  filePath: string,
  dataset: MonitorState["datasets"][number],
): MonitorState {
  if (requestId !== state.archivedSnapshotRequestId) {
    return state;
  }

  const nextState = {
    ...state,
    archivedSnapshotLoading: false,
    hydratedDatasetsByFilePath: {
      ...state.hydratedDatasetsByFilePath,
      [filePath]: dataset,
    },
    datasets: upsertDataset(state, dataset),
  };

  return {
    ...nextState,
    ...buildDatasetActivationPatch(nextState, dataset),
  };
}

export function finishArchivedSnapshotRequest(
  state: MonitorState,
  requestId: number,
): MonitorState {
  return requestId === state.archivedSnapshotRequestId
    ? { ...state, archivedSnapshotLoading: false }
    : state;
}
