import { useState } from "react";

export function useLaneSummaryDisclosure(observabilityKey: string) {
  const [laneSummaryState, setLaneSummaryState] = useState({
    key: observabilityKey,
    open: false,
  });
  const laneSummaryOpen =
    laneSummaryState.key === observabilityKey ? laneSummaryState.open : false;

  return {
    laneSummaryOpen,
    toggleLaneSummary() {
      setLaneSummaryState({
        key: observabilityKey,
        open: !laneSummaryOpen,
      });
    },
  };
}
