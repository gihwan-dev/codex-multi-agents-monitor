import type { DrawerTab, InspectorCausalSummary } from "../../../entities/run";
import { Button } from "../../../shared/ui/primitives";
import { INSPECTOR_PAYLOAD_ACTIONS } from "../lib/payloadActions";

interface CausalInspectorPayloadSectionProps {
  onOpenDrawer: (tab: DrawerTab) => void;
  summary: InspectorCausalSummary | null;
}

export function CausalInspectorPayloadSection({
  onOpenDrawer,
  summary,
}: CausalInspectorPayloadSectionProps) {
  if (!summary) {
    return <p className="text-sm text-muted-foreground">No payload preview yet.</p>;
  }

  return (
    <div className="grid gap-3">
      <p className="text-[0.8rem] leading-6 text-muted-foreground">{summary.payloadPreview}</p>
      <span className="text-[0.82rem] text-muted-foreground">{summary.rawStatusLabel}</span>
      <div className="flex flex-wrap gap-2">
        {INSPECTOR_PAYLOAD_ACTIONS.map((action) => (
          <Button
            key={action.tab}
            type="button"
            variant="outline"
            size="xs"
            className="border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.06]"
            onClick={() => onOpenDrawer(action.tab)}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
