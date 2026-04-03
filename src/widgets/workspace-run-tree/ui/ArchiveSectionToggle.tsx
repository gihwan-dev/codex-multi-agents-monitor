import { ChevronRight } from "lucide-react";
import { cn } from "../../../shared/lib";

interface ArchiveSectionToggleProps {
  archiveSectionOpen: boolean;
  archivedTotal: number;
  onToggleArchiveSection: () => void;
}

export function ArchiveSectionToggle({
  archiveSectionOpen,
  archivedTotal,
  onToggleArchiveSection,
}: ArchiveSectionToggleProps) {
  return (
    <button type="button" data-slot="archive-section-toggle" className="flex min-h-7 w-full translate-x-0 items-center gap-2 rounded-md px-1 py-1 text-left text-muted-foreground transition-[translate,background-color,color] duration-[var(--duration-fast)] ease-[var(--easing-emphasized)] hover:translate-x-0.5 hover:bg-white/[0.03]" onClick={onToggleArchiveSection} aria-expanded={archiveSectionOpen}>
      <ChevronRight className={cn("size-3 transition-transform", archiveSectionOpen && "rotate-90")} aria-hidden="true" />
      <span className="text-[0.78rem] font-medium tracking-[0.01em]">Archive</span>
      <span data-slot="archive-count" className="ml-auto text-[0.7rem] text-[var(--color-text-tertiary)]">{archivedTotal}</span>
    </button>
  );
}
