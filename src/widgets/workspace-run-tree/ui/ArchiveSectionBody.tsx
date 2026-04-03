import type { ArchivedSessionIndexItem } from "../../../entities/session-log";
import { ArchivedSessionList } from "./ArchivedSessionList";

interface ArchiveSectionBodyProps {
  activeArchivedFilePath: string | null;
  archiveSectionOpen: boolean;
  archivedHasMore: boolean;
  archivedIndex: ArchivedSessionIndexItem[];
  archivedIndexError: string | null;
  archivedIndexLoading: boolean;
  archivedSearch: string;
  archivedTotal: number;
  mounted: boolean;
  onArchiveLoadMore: () => void;
  onArchiveSearch: (query: string) => void;
  onArchiveSelect: (filePath: string) => void;
  state: "open" | "closed";
}

export function ArchiveSectionBody({
  activeArchivedFilePath,
  archiveSectionOpen,
  archivedHasMore,
  archivedIndex,
  archivedIndexError,
  archivedIndexLoading,
  archivedSearch,
  archivedTotal,
  mounted,
  onArchiveLoadMore,
  onArchiveSearch,
  onArchiveSelect,
  state,
}: ArchiveSectionBodyProps) {
  return (
    <div data-slot="archive-section-body" data-state={state} aria-hidden={!archiveSectionOpen} className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-[var(--duration-normal)] ease-[var(--easing-emphasized)] data-[state=open]:grid-rows-[1fr] data-[state=open]:opacity-100">
      {mounted ? (
        <div data-slot="archive-section-body-inner" className="min-h-0 overflow-hidden">
          <ArchivedSessionList items={archivedIndex} total={archivedTotal} hasMore={archivedHasMore} indexLoading={archivedIndexLoading} errorMessage={archivedIndexError} activeFilePath={activeArchivedFilePath} search={archivedSearch} onSearch={onArchiveSearch} onLoadMore={onArchiveLoadMore} onSelect={onArchiveSelect} />
        </div>
      ) : null}
    </div>
  );
}
