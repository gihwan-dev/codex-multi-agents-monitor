interface SkillActivityEmptyStateProps {
  hasCatalog: boolean;
}

export function SkillActivityEmptyState({ hasCatalog }: SkillActivityEmptyStateProps) {
  if (!hasCatalog) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          No skill catalog found
        </p>
        <p className="max-w-[32rem] text-xs text-muted-foreground/70">
          Loaded sessions do not include a skills-catalog prompt layer. Import a session that includes prompt assembly data to view skill activity.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-sm font-medium text-muted-foreground">
        No skills match current filters
      </p>
      <p className="text-xs text-muted-foreground/70">
        Try adjusting the status filter or search query.
      </p>
    </div>
  );
}
