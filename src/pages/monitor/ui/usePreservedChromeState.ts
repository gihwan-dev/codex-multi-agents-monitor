import { useRef } from "react";
import type {
  AnomalyJump,
  ContextObservabilityModel,
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
  contextObservability: ContextObservabilityModel | null;
  summaryFacts: SummaryFact[];
}

interface UsePreservedChromeStateOptions {
  activeDataset: RunDataset | null;
  activeFollowLive: boolean;
  activeLiveConnection: LiveConnection;
  anomalyJumps: AnomalyJump[];
  contextObservability: ContextObservabilityModel | null;
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
  contextObservability,
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
      contextObservability,
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
