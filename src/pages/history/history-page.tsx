import { useQuery } from "@tanstack/react-query";

import { HistoryShell } from "@/features/history/ui/history-shell";
import { getHistorySummary } from "@/shared/lib/tauri/commands";

export function HistoryPage() {
  const historyQuery = useQuery({
    queryKey: ["monitor", "history_summary"],
    queryFn: getHistorySummary,
  });

  return (
    <HistoryShell
      summary={historyQuery.data ?? null}
      isLoading={historyQuery.isLoading}
    />
  );
}
