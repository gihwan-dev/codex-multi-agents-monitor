import type { Dispatch } from "react";
import {
  useCancelPendingSelectionLoad,
  useMonitorRequestRefs,
} from "./monitorRequestControllerShared";
import type { MonitorAction, MonitorState } from "./state";
import { useArchiveMonitorRequests } from "./useArchiveMonitorRequests";
import { useRecentMonitorRequests } from "./useRecentMonitorRequests";

interface UseMonitorRequestControllerOptions {
  state: MonitorState;
  dispatch: Dispatch<MonitorAction>;
}

export function useMonitorRequestController({
  state,
  dispatch,
}: UseMonitorRequestControllerOptions) {
  const requestRefs = useMonitorRequestRefs();
  const cancelPendingSelectionLoad = useCancelPendingSelectionLoad(dispatch, requestRefs);
  const recentRequests = useRecentMonitorRequests({
    state,
    dispatch,
    cancelPendingSelectionLoad,
    recentSnapshotRequestIdRef: requestRefs.recentSnapshotRequestIdRef,
    recentLiveRefreshInFlightRef: requestRefs.recentLiveRefreshInFlightRef,
  });
  const archiveRequests = useArchiveMonitorRequests({
    state,
    dispatch,
    cancelPendingSelectionLoad,
    archiveIndexRequestIdRef: requestRefs.archiveIndexRequestIdRef,
    archiveSnapshotRequestIdRef: requestRefs.archiveSnapshotRequestIdRef,
  });

  return {
    cancelPendingSelectionLoad,
    ...recentRequests,
    ...archiveRequests,
  };
}
