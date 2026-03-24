import type { ReactNode } from "react";
import type { DrawerTab, InspectorCausalSummary } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { Button, ScrollArea, Separator } from "../../../shared/ui/primitives";
import type { InspectorSectionConfig } from "./CausalInspectorSections";

const PAYLOAD_ACTIONS: Array<{ tab: DrawerTab; label: string }> = [
  { tab: "artifacts", label: "Artifacts" },
  { tab: "context", label: "Context" },
  { tab: "log", label: "Log" },
  { tab: "raw", label: "Raw" },
];

export function InspectorSections({ sections }: { sections: InspectorSectionConfig[] }) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="grid gap-3 pr-3">
        {sections.map((section) => (
          <Section key={section.key} title={section.title}>
            {section.content}
          </Section>
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
      <h3 className="text-[0.95rem] font-semibold leading-5">{summary.title}</h3>
      <p className="text-[0.8rem] leading-6 text-muted-foreground">{summary.preview}</p>
      <Separator className="bg-white/8" />
      <dl className="grid gap-2">
        {summary.facts.map((fact) => (
          <div
            key={fact.label}
            className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2"
          >
            <dt className="text-[0.78rem] font-medium text-muted-foreground">{fact.label}</dt>
            <dd
              className={cn(
                "m-0 rounded bg-white/[0.07] px-2 py-1 text-[0.78rem] tabular-nums",
                fact.emphasis === "danger" && "text-[var(--color-failed)]",
                fact.emphasis === "warning" && "text-[var(--color-waiting)]",
                fact.emphasis === "accent" && "text-[var(--color-active)]",
              )}
            >
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
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
      <p className="text-[0.8rem] leading-6 text-muted-foreground">{summary.payloadPreview}</p>
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

export function JumpButton({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="grid gap-1 rounded-[10px] border border-white/8 bg-white/[0.02] px-3 py-2 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-active)]/45"
      onClick={onClick}
    >
      <strong className="text-sm font-semibold">{label}</strong>
      <span className="text-[0.78rem] text-muted-foreground">{description}</span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2 rounded-[10px] border border-white/8 bg-white/[0.025] px-3 py-3">
      <header>
        <h3 className="text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
          {title}
        </h3>
      </header>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}
