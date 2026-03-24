import type { LiveMode, SelectionState } from "../../../entities/run";

export function createEdgeSelectHandler(options: {
  followLive: boolean;
  liveMode: LiveMode;
  onPauseFollowLive: () => void;
  onSelect: (selection: SelectionState) => void;
}) {
  return (edgeId: string) => {
    if (options.followLive && options.liveMode === "live") {
      options.onPauseFollowLive();
    }

    options.onSelect({ kind: "edge", id: edgeId });
  };
}
