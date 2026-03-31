import { cn } from "../../../shared/lib";
import { GraphContextCardCause } from "./GraphContextCardCause";
import { GraphContextCardHeader } from "./GraphContextCardHeader";
import { CARD_BORDER_CLASS_NAMES } from "./graphContextCardStyles";
import type { buildGraphContextRailPresentation } from "./graphContextRailModel";

export function GraphContextCard({
  presentation,
}: {
  presentation: NonNullable<ReturnType<typeof buildGraphContextRailPresentation>>;
}) {
  return (
    <div
      data-slot="graph-context-card-overlay"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[6] flex items-end justify-end overflow-hidden p-4"
    >
      <div
        data-slot="graph-context-card"
        className="w-full max-w-72 min-w-0 shrink-0"
      >
        <div
          className={cn(
            "rounded-[20px] border bg-[color:color-mix(in_srgb,var(--color-panel)_94%,black)] px-3.5 py-3 shadow-[0_18px_45px_rgba(0,0,0,0.36)] backdrop-blur-md",
            CARD_BORDER_CLASS_NAMES.default,
          )}
        >
          <GraphContextCardHeader presentation={presentation} />
          <GraphContextCardCause presentation={presentation} />
        </div>
      </div>
    </div>
  );
}
