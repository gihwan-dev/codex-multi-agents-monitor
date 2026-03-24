import { ChevronRight } from "lucide-react";
import type { ArchivedSessionIndexItem } from "../../../entities/session-log";
import { cn } from "../../../shared/lib";
import { ArchivedSessionList } from "./ArchivedSessionList";

interface WorkspaceRunTreeArchiveSectionProps {
  activeArchivedFilePath: string | null;
  archiveSectionOpen: boolean;
  archivedHasMore: boolean;
  archivedIndex: ArchivedSessionIndexItem[];
  archivedIndexError: string | null;
  archivedIndexLoading: boolean;
  archivedSearch: string;
  archivedTotal: number;
  onArchiveLoadMore: () => void;
  onArchiveSearch: (query: string) => void;
  onArchiveSelect: (filePath: string) => void;
  onToggleArchiveSection: () => void;
}

export function WorkspaceRunTreeArchiveSection({
  activeArchivedFilePath,
  archiveSectionOpen,
  archivedHasMore,
  archivedIndex,
  archivedIndexError,
  archivedIndexLoading,
  archivedSearch,
  archivedTotal,
  onArchiveLoadMore,
  onArchiveSearch,
  onArchiveSelect,
  onToggleArchiveSection,
}: WorkspaceRunTreeArchiveSectionProps) {
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
