import type { InspectorCausalSummary, SelectionState } from "../../../entities/run";
import type { InspectorSectionConfig } from "./CausalInspectorSections";
import { JumpButton } from "./CausalInspectorViews";

interface BuildJumpSectionOptions {
  key: string;
  title: string;
  items: InspectorCausalSummary["upstream"];
  onSelectJump: (selection: SelectionState) => void;
}

export function buildJumpSection({
  key,
  title,
  items,
  onSelectJump,
}: BuildJumpSectionOptions) {
  if (!items.length) {
    return null;
  }

  return {
    key,
    title,
    content: (
      <>
        {items.map((item) => (
          <JumpButton
            key={`${item.label}:${item.selection.id}`}
            label={item.label}
            description={item.description}
            onClick={() => onSelectJump(item.selection)}
          />
        ))}
      </>
    ),
  } satisfies InspectorSectionConfig;
}
