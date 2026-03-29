import type { SkillActivityItem } from "../../../entities/skill";
import { ScrollArea } from "../../../shared/ui/primitives/scroll-area";
import { SkillActivityEmptyState } from "./SkillActivityEmptyState";
import { SkillActivityRow } from "./SkillActivityRow";

interface SkillActivityGridProps {
  items: readonly SkillActivityItem[];
  hasCatalog: boolean;
  loading?: boolean;
}

function GridHeader() {
  return (
    <div className="grid grid-cols-[10rem_1fr_6rem_6rem] gap-3 border-b border-white/8 px-4 py-2 text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
      <span>Status</span>
      <span>Skill</span>
      <span className="text-right">Calls</span>
      <span className="text-right">Last seen</span>
    </div>
  );
}

export function SkillActivityGrid({ items, hasCatalog, loading }: SkillActivityGridProps) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Scanning sessions for skill activity…
      </div>
    );
  }

  if (items.length === 0) {
    return <SkillActivityEmptyState hasCatalog={hasCatalog} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-soft)] border border-white/8 bg-white/[0.02]">
      <GridHeader />
      <ScrollArea className="flex-1">
        <div>
          {items.map((item) => (
            <SkillActivityRow
              key={item.skillName}
              item={item}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
