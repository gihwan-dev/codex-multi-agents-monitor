import { cn } from "../../../shared/lib";
import { CHANGE_PILL_CLASS_NAMES } from "./graphContextCardStyles";
import type { buildGraphContextRailPresentation } from "./graphContextRailModel";

export function GraphContextCardMetrics({
  presentation,
}: {
  presentation: NonNullable<ReturnType<typeof buildGraphContextRailPresentation>>;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      <ContextMetric label="Seen so far" value={presentation.cumulativeValueLabel} />
      <ContextMetric
        label="Latest change"
        value={presentation.changeDeltaLabel}
        valueClassName={CHANGE_PILL_CLASS_NAMES[presentation.changeTone]}
      />
    </div>
  );
}

function ContextMetric(props: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <span className="block text-[0.58rem] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        {props.label}
      </span>
      <span
        className={cn(
          "mt-1.5 block truncate text-[0.8rem] font-medium text-foreground",
          props.valueClassName
            ? "inline-flex max-w-full rounded-full border px-2 py-1 text-[0.72rem] leading-none"
            : undefined,
          props.valueClassName,
        )}
      >
        {props.value}
      </span>
    </div>
  );
}
