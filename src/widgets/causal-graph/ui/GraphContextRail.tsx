import type { ContextObservabilityModel } from "../../../entities/run";
import { GraphContextCard } from "./GraphContextCard";
import { buildGraphContextRailPresentation } from "./graphContextRailModel";

interface GraphContextRailProps {
  observability: ContextObservabilityModel | null;
}

export function GraphContextRail({ observability }: GraphContextRailProps) {
  const presentation = observability
    ? buildGraphContextRailPresentation({ observability })
    : null;
  if (!presentation) {
    return null;
  }

  return <GraphContextCard presentation={presentation} />;
}
