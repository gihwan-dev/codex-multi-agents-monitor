import type { RefObject } from "react";
import { Button, Input } from "../../../shared/ui/primitives";

interface WorkspaceRunTreeHeaderProps {
  searchRef: RefObject<HTMLInputElement | null>;
  search: string;
  setSearch: (value: string) => void;
  onOpenImport: () => void;
}

export function WorkspaceRunTreeHeader({
  searchRef,
  search,
  setSearch,
  onOpenImport,
}: WorkspaceRunTreeHeaderProps) {
  return (
    <div
      data-slot="run-tree-header"
      className="grid gap-2 border-b border-white/8 pb-3 md:grid-cols-[minmax(0,1fr)_auto]"
    >
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
  );
}
