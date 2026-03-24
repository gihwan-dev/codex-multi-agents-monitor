import type { RefObject } from "react";

import type { GraphSceneModel, LiveMode } from "../../../entities/run";
import type { GraphLayoutSnapshot } from "../model/graphLayout";

interface ReadFollowLiveContextOptions {
  latestVisibleEventId: string;
  layout: GraphLayoutSnapshot;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export function readActiveFollowLiveEventId(
  followLive: boolean,
  latestVisibleEventId: GraphSceneModel["latestVisibleEventId"],
  liveMode: LiveMode,
) {
  if (!followLive || liveMode !== "live") {
    return null;
  }

  return latestVisibleEventId;
}

function isViewportUnavailable(element: HTMLDivElement) {
  return element.clientHeight <= 0 || element.clientWidth <= 0;
}

export function readFollowLiveContext(options: ReadFollowLiveContextOptions) {
  const element = options.scrollRef.current;
  const eventLayout = options.layout.eventById.get(options.latestVisibleEventId);
  if (!element || !eventLayout || isViewportUnavailable(element)) {
    return null;
  }

  return { element, eventLayout };
}
