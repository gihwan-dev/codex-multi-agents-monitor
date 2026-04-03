import { useState } from "react";

export function useEvalSelectionState() {
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return {
    refreshKey,
    selectedExperimentId,
    selectedCaseId,
    refresh: () => setRefreshKey((value) => value + 1),
    selectExperiment: setSelectedExperimentId,
    selectCase: setSelectedCaseId,
  };
}
