import { cn } from "../../../shared/lib";
import { BAR_FILL_CLASS_NAMES } from "./graphContextCardStyles";
import type { buildGraphContextRailPresentation } from "./graphContextRailModel";

export function GraphContextCardProgress({
  presentation,
}: {
  presentation: NonNullable<ReturnType<typeof buildGraphContextRailPresentation>>;
}) {
  const width = presentation.hasLimit
    ? `${Math.max(presentation.fillRatio * 100, presentation.hasUsage ? 5 : 0)}%`
    : "0%";

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[0.68rem] text-[var(--color-text-muted)]">
        <span data-slot="graph-context-card-progress-label">
          {presentation.progressLabel}
        </span>
        <span data-slot="graph-context-card-limit">
          {presentation.hasLimit ? `${presentation.maxValueLabel} max` : "limit unavailable"}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/8 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
        <div
          data-slot="graph-context-card-progress-fill"
          className={cn(
            "h-full rounded-full transition-[width,background-color] duration-200",
            BAR_FILL_CLASS_NAMES[presentation.tone],
          )}
          style={{ width }}
        />
      </div>
    </div>
  );
}
