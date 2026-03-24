import type { EventRecord, RunDataset, SelectionState } from "../model/types.js";

export interface GraphSceneRowsArgs {
  dataset: RunDataset;
  visibleEvents: EventRecord[];
  laneIds: Set<string>;
  visibleLaneCount: number;
  selection: SelectionState | null;
  selectionPathEventIds: Set<string>;
  hasMultiAgentTopology: boolean;
}

export interface BuildGapHiddenEventIdsArgs {
  events: EventRecord[];
  visibleEventIdSet: Set<string>;
  gapStart: number;
  gapEnd: number;
}

export interface BuildGapRowArgs {
  dataset: RunDataset;
  previousEvent: EventRecord | undefined;
  event: EventRecord;
  visibleEventIdSet: Set<string>;
  idleLaneCount: number;
}

export interface BuildEventRowArgs {
  event: EventRecord;
  selection: SelectionState | null;
  selectionPathEventIds: Set<string>;
  hasMultiAgentTopology: boolean;
}
