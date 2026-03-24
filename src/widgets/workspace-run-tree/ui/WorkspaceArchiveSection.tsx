import { ChevronRight } from "lucide-react";
import type { ArchivedSessionIndexItem } from "../../../entities/session-log";
import { cn } from "../../../shared/lib";
import { ArchivedSessionList } from "./ArchivedSessionList";

interface WorkspaceArchiveSectionProps {
  archivedIndex: ArchivedSessionIndexItem[];
  archivedTotal: number;
  archivedHasMore: boolean;
  archivedIndexLoading: boolean;
  archivedIndexError: string | null;
  activeArchivedFilePath: string | null;
  archivedSearch: string;
  archiveSectionOpen: boolean;
  onToggleArchiveSection: () => void;
  onArchiveSearch: (query: string) => void;
  onArchiveLoadMore: () => void;
  onArchiveSelect: (filePath: string) => void;
}

export function WorkspaceArchiveSection({
  archivedIndex,
  archivedTotal,
  archivedHasMore,
  archivedIndexLoading,
  archivedIndexError,
  activeArchivedFilePath,
  archivedSearch,
  archiveSectionOpen,
  onToggleArchiveSection,
  onArchiveSearch,
  onArchiveLoadMore,
  onArchiveSelect,
}: WorkspaceArchiveSectionProps) {
  if (!archivedIndexError && archivedTotal === 0 && archivedIndex.length === 0) {
    return null;
  }

  return (
    <section data-slot="archive-section" className="mt-1 border-t border-white/8 pt-2">
      <button
        type="button"
        data-slot="archive-section-toggle"
        className="flex min-h-7 w-full items-center gap-2 rounded-md px-1 py-1 text-left text-muted-foreground transition-colors hover:bg-white/[0.03]"
        onClick={onToggleArchiveSection}
        aria-expanded={archiveSectionOpen}
      >
        <ChevronRight
          className={cn("size-3 transition-transform", archiveSectionOpen && "rotate-90")}
          aria-hidden="true"
        />
        <span className="text-[0.78rem] font-medium tracking-[0.01em]">Archive</span>
        <span
          data-slot="archive-count"
          className="ml-auto text-[0.7rem] text-[var(--color-text-tertiary)]"
        >
          {archivedTotal}
        </span>
      </button>
      {archiveSectionOpen ? (
        <ArchivedSessionList
          items={archivedIndex}
          total={archivedTotal}
          hasMore={archivedHasMore}
          indexLoading={archivedIndexLoading}
          errorMessage={archivedIndexError}
          activeFilePath={activeArchivedFilePath}
          search={archivedSearch}
          onSearch={onArchiveSearch}
          onLoadMore={onArchiveLoadMore}
          onSelect={onArchiveSelect}
        />
      ) : null}
    </section>
  );
}
