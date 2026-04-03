import type { DrawerTab, InspectorCausalSummary } from "../../../entities/run";
import { Button, ScrollArea, Separator } from "../../../shared/ui/primitives";
import { CausalInspectorSection } from "./CausalInspectorSection";
import type { InspectorSectionConfig } from "./CausalInspectorSections";
import { SummaryExpandButton } from "./SummaryExpandButton";
import { SummaryFactList } from "./SummaryFactList";

export { CausalInspectorJumpButton as JumpButton } from "./CausalInspectorJumpButton";

const PAYLOAD_ACTIONS: Array<{ tab: DrawerTab; label: string }> = [
  { tab: "artifacts", label: "Artifacts" },
  { tab: "context", label: "Context" },
  { tab: "log", label: "Log" },
  { tab: "raw", label: "Raw" },
];

export function InspectorSections({
  motionKey,
  sections,
}: {
  motionKey: string;
  sections: InspectorSectionConfig[];
}) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div key={motionKey} data-slot="inspector-sections" className="grid min-w-0 gap-3 pr-3">
        {sections.map((section, index) => (
          <CausalInspectorSection key={section.key} index={index} title={section.title}>
            {section.content}
          </CausalInspectorSection>
        ))}
      </div>
    </ScrollArea>
  );
}

export function CompactSummary({ summary }: { summary: InspectorCausalSummary | null }) {
  if (!summary) {
    return <p className="text-sm text-muted-foreground">Select a row to preview the active blocker path.</p>;
  }

  return (
    <div className="grid gap-2">
      <p className="text-[0.78rem] text-muted-foreground">Selection summary</p>
      <strong className="text-sm font-semibold">{summary.title}</strong>
      <p className="text-sm text-muted-foreground">{summary.preview}</p>
      <div className="flex flex-wrap gap-2 text-[0.78rem] text-muted-foreground">
        {summary.facts.slice(0, 3).map((fact) => (
          <span key={fact.label}>{fact.value}</span>
        ))}
      </div>
    </div>
  );
}

export function SummarySection({ summary }: { summary: InspectorCausalSummary | null }) {
  if (!summary) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a row, edge, or artifact to inspect its causal summary.
      </p>
    );
  }

  return (
    <>
      <SummaryExpandButton summary={summary} />
      <h3 className="text-[0.95rem] font-semibold leading-5">{summary.title}</h3>
      <p className="break-words text-[0.8rem] leading-6 text-muted-foreground">{summary.preview}</p>
      <Separator className="bg-white/8" />
      <SummaryFactList facts={summary.facts} />
    </>
  );
}

export function PayloadSection({
  summary,
  onOpenDrawer,
}: {
  summary: InspectorCausalSummary | null;
  onOpenDrawer: (tab: DrawerTab) => void;
}) {
  if (!summary) {
    return <p className="text-sm text-muted-foreground">No payload preview yet.</p>;
  }

  return (
    <div className="grid gap-3">
      <span className="text-[0.82rem] text-muted-foreground">{summary.rawStatusLabel}</span>
      <div className="flex flex-wrap gap-2">
        {PAYLOAD_ACTIONS.map((action) => (
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
