import type { RefObject } from "react";
import type { WorkspaceScoreFilterKey, WorkspaceScoreSortKey } from "../../../entities/run";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/ui/primitives";

interface WorkspaceRunTreeHeaderProps {
  searchRef: RefObject<HTMLInputElement | null>;
  search: string;
  scoreFilter: WorkspaceScoreFilterKey;
  scoreSort: WorkspaceScoreSortKey;
  setScoreFilter: (value: WorkspaceScoreFilterKey) => void;
  setScoreSort: (value: WorkspaceScoreSortKey) => void;
  setSearch: (value: string) => void;
  onOpenImport: () => void;
}

export function WorkspaceRunTreeHeader({
  searchRef,
  search,
  scoreFilter,
  scoreSort,
  setScoreFilter,
  setScoreSort,
  setSearch,
  onOpenImport,
}: WorkspaceRunTreeHeaderProps) {
  return (
    <div
      data-slot="run-tree-header"
      className="grid gap-2 border-b border-white/8 pb-3"
    >
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          ref={searchRef}
          type="search"
          className="border-white/10 bg-white/[0.03] text-foreground"
          placeholder="Search workspaces and runs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search workspaces and runs"
        />
        <Button
          type="button"
          variant="outline"
          className="border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.06]"
          onClick={onOpenImport}
        >
          Import
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={scoreSort} onValueChange={(value) => setScoreSort(value as WorkspaceScoreSortKey)}>
          <SelectTrigger className="h-8 border-white/10 bg-white/[0.03] text-[0.78rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Sort: Recent</SelectItem>
            <SelectItem value="score">Sort: Score</SelectItem>
          </SelectContent>
        </Select>
        <Select value={scoreFilter} onValueChange={(value) => setScoreFilter(value as WorkspaceScoreFilterKey)}>
          <SelectTrigger className="h-8 border-white/10 bg-white/[0.03] text-[0.78rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Filter: All runs</SelectItem>
            <SelectItem value="scored">Filter: Scored only</SelectItem>
            <SelectItem value="high">Filter: 80+ only</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
