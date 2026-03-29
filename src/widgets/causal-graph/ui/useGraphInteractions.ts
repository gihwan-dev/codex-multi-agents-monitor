import type { GraphSceneModel, LiveMode, SelectionState } from "../../../entities/run";
import { createEdgeSelectHandler } from "./graphEdgeSelectHandler";
import { resolveViewportFocusEventId } from "./graphViewportFocus";
import { useViewportFocusEffect } from "./useViewportFocusEffect";

interface GraphInteractionsArgs {
  followLive: boolean;
  liveMode: LiveMode;
  onPauseFollowLive: () => void;
  onSelect: (selection: SelectionState) => void;
  onViewportFocusEventChange?: (eventId: string | null) => void;
  visibleRows: GraphSceneModel["rows"];
}

export function useGraphInteractions(args: GraphInteractionsArgs) {
  const handleSelectEdge = createEdgeSelectHandler({
    followLive: args.followLive,
    liveMode: args.liveMode,
    onPauseFollowLive: args.onPauseFollowLive,
    onSelect: args.onSelect,
  });

  useViewportFocusEffect(
    args.onViewportFocusEventChange,
    resolveViewportFocusEventId(args.visibleRows),
  );

  return handleSelectEdge;
}
