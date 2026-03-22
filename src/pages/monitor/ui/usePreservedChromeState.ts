import { useRef } from "react";
import type {
  AnomalyJump,
  LiveConnection,
  RunDataset,
  SummaryFact,
} from "../../../entities/run";

interface PreservedChromeState {
  anomalyJumps: AnomalyJump[];
  dataset: RunDataset;
  followLive: boolean;
  inspectorTitle: string | null;
  liveConnection: LiveConnection;
  summaryFacts: SummaryFact[];
}

interface UsePreservedChromeStateOptions {
  activeDataset: RunDataset | null;
  activeFollowLive: boolean;
  activeLiveConnection: LiveConnection;
  anomalyJumps: AnomalyJump[];
  inspectorTitle: string | null;
  rawTabAvailable: boolean;
  selectionLoadStateActive: boolean;
  summaryFacts: SummaryFact[];
}

export function usePreservedChromeState({
  activeDataset,
  activeFollowLive,
  activeLiveConnection,
  anomalyJumps,
  inspectorTitle,
  rawTabAvailable,
  selectionLoadStateActive,
  summaryFacts,
}: UsePreservedChromeStateOptions) {
  const preservedChromeRef = useRef<PreservedChromeState | null>(null);

  const displayDataset = selectionLoadStateActive ? null : activeDataset;
  const displayRawTabAvailable = displayDataset ? rawTabAvailable : false;

  if (displayDataset) {
    preservedChromeRef.current = {
      anomalyJumps,
      dataset: displayDataset,
      followLive: activeFollowLive,
      inspectorTitle,
      liveConnection: activeLiveConnection,
      summaryFacts,
    };
  }

  const chromeState = selectionLoadStateActive
    ? preservedChromeRef.current
    : displayDataset
      ? preservedChromeRef.current
      : null;

  return {
    chromeState,
    displayDataset,
    displayRawTabAvailable,
    hideGraphChrome: Boolean(selectionLoadStateActive && chromeState),
  };
}
