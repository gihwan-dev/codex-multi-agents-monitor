export { buildTimelineProjection, resolveTimelineSelection } from "./model/projection";
export {
  createInitialTimelineViewport,
  disableTimelineFollow,
  refollowLatest,
  timelineContentHeight,
  timelineItemPosition,
  timelineSpanHeight,
  timelineTickLabels,
  zoomTimelineViewport,
} from "./model/viewport";
export type {
  TimelineItemKind,
  TimelineItemView,
  TimelineLaneView,
  TimelineMode,
  TimelineProjection,
  TimelineSelection,
  TimelineViewportState,
} from "./model/types";
export { TimelineCanvas } from "./ui/timeline-canvas";
export { DetailDrawer } from "./ui/detail-drawer";
