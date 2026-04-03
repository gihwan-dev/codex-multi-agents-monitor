import type { CandidateRun } from "../../../entities/eval";
import { formatCurrency, formatDuration, formatTokens } from "../../../shared/lib/format";

export function buildRunStats(run: CandidateRun) {
  return [
    {
      label: "Wall clock",
      value: run.executionStats.wallClockMs
        ? formatDuration(run.executionStats.wallClockMs)
        : "n/a",
    },
    {
      label: "Tokens",
      value: run.executionStats.totalTokens
        ? formatTokens(run.executionStats.totalTokens)
        : "n/a",
    },
    {
      label: "Cost",
      value:
        run.executionStats.estimatedCostUsd !== null
          ? formatCurrency(run.executionStats.estimatedCostUsd)
          : "n/a",
    },
    {
      label: "Cache hits",
      value: `${run.executionStats.cacheHitCount ?? 0}`,
    },
    {
      label: "Tool calls",
      value: `${run.executionStats.toolCallCount ?? 0}`,
    },
    {
      label: "Approvals",
      value: `${run.executionStats.approvalRequestCount ?? 0}`,
    },
  ];
}
