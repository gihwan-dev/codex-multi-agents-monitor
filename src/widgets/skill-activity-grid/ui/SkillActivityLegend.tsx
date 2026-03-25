import { FRESHNESS_TAGS, SOURCE_TAGS } from "../../../entities/skill";
import {
  FRESHNESS_COLORS,
  FRESHNESS_DESCRIPTIONS,
  FRESHNESS_LABELS,
  SOURCE_COLORS,
  SOURCE_DESCRIPTIONS,
  SOURCE_LABELS,
} from "../../../shared/ui/monitor/SkillStatusBadge.constants";

interface LegendEntryProps {
  label: string;
  color: string;
  description: string;
}

function LegendEntry({ label, color, description }: LegendEntryProps) {
  return (
    <div className="flex items-center gap-2" title={description}>
      <span className="inline-block size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[0.68rem] text-muted-foreground">
        <strong className="font-medium text-foreground/80">{label}</strong>
        {" — "}
        {description}
      </span>
    </div>
  );
}

export function SkillActivityLegend() {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-[0.68rem] text-muted-foreground hover:text-foreground/70">
        Tag legend
      </summary>
      <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 rounded-[var(--radius-soft)] border border-white/8 bg-white/[0.02] px-3 py-2">
        <div className="flex flex-col gap-1">
          <span className="mb-0.5 text-[0.62rem] uppercase tracking-widest text-muted-foreground/60">Freshness</span>
          {FRESHNESS_TAGS.map((tag) => (
            <LegendEntry key={tag} label={FRESHNESS_LABELS[tag]} color={FRESHNESS_COLORS[tag]} description={FRESHNESS_DESCRIPTIONS[tag]} />
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <span className="mb-0.5 text-[0.62rem] uppercase tracking-widest text-muted-foreground/60">Source</span>
          {SOURCE_TAGS.map((tag) => (
            <LegendEntry key={tag} label={SOURCE_LABELS[tag]} color={SOURCE_COLORS[tag]} description={SOURCE_DESCRIPTIONS[tag]} />
          ))}
        </div>
      </div>
    </details>
  );
}
