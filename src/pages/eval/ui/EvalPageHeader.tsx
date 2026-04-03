import { RefreshCcw } from "lucide-react";
import { Badge, Button } from "../../../shared/ui/primitives";

interface EvalPageHeaderProps {
  onNavigateToMonitor: () => void;
  onRefresh: () => void;
}

export function EvalPageHeader({
  onNavigateToMonitor,
  onRefresh,
}: EvalPageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 rounded-[var(--radius-panel)] border border-white/8 bg-white/[0.03] px-5 py-4">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Eval compare</h1>
          <Badge variant="outline">baseline vs candidate</Badge>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Compare different runs within the same experiment to spot improvements,
          regressions, and tradeoffs on shared evaluation cases.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onNavigateToMonitor}>
          Back to monitor
        </Button>
        <Button type="button" variant="outline" onClick={onRefresh}>
          <RefreshCcw className="size-4" />
          Refresh
        </Button>
      </div>
    </header>
  );
}
