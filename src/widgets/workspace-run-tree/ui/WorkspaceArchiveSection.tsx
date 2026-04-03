import type { ArchivedSessionIndexItem } from "../../../entities/session-log";
import { ArchiveSectionBody } from "./ArchiveSectionBody";
import { ArchiveSectionToggle } from "./ArchiveSectionToggle";
import { useExpandablePresence } from "./workspaceTreeMotion";

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
  const { mounted, state } = useExpandablePresence(archiveSectionOpen);

  if (!archivedIndexError && archivedTotal === 0 && archivedIndex.length === 0) {
    return null;
  }

  return (
    <section data-slot="archive-section" className="mt-1 border-t border-white/8 pt-2">
      <ArchiveSectionToggle archiveSectionOpen={archiveSectionOpen} archivedTotal={archivedTotal} onToggleArchiveSection={onToggleArchiveSection} />
      <ArchiveSectionBody activeArchivedFilePath={activeArchivedFilePath} archiveSectionOpen={archiveSectionOpen} archivedHasMore={archivedHasMore} archivedIndex={archivedIndex} archivedIndexError={archivedIndexError} archivedIndexLoading={archivedIndexLoading} archivedSearch={archivedSearch} archivedTotal={archivedTotal} mounted={mounted} onArchiveLoadMore={onArchiveLoadMore} onArchiveSearch={onArchiveSearch} onArchiveSelect={onArchiveSelect} state={state} />
    </section>
  );
}
