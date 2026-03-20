import { buildDatasetActivationPatch, upsertDataset } from "./helpers";
import type { MonitorState } from "./types";

export function beginArchivedIndexRequest(state: MonitorState, requestId: number): MonitorState {
  return {
    ...state,
    archivedIndexLoading: true,
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
  };
}

export function finishArchivedIndexRequest(
  state: MonitorState,
  requestId: number,
): MonitorState {
  return requestId === state.archivedIndexRequestId
    ? { ...state, archivedIndexLoading: false }
    : state;
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
  dataset: MonitorState["datasets"][number],
): MonitorState {
  if (requestId !== state.archivedSnapshotRequestId) {
    return state;
  }

  return {
    ...state,
    archivedSnapshotLoading: false,
    datasets: upsertDataset(state, dataset),
    ...buildDatasetActivationPatch(state, dataset),
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
