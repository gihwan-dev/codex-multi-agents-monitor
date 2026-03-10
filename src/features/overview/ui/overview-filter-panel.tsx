type OverviewFilterPanelProps = {
  workspaceFilter: string;
  roleFilter: string;
  severityFilter: string;
  workspaceOptions: string[];
  roleOptions: string[];
  onWorkspaceFilterChange: (value: string) => void;
  onRoleFilterChange: (value: string) => void;
  onSeverityFilterChange: (value: string) => void;
};

export function OverviewFilterPanel({
  workspaceFilter,
  roleFilter,
  severityFilter,
  workspaceOptions,
  roleOptions,
  onWorkspaceFilterChange,
  onRoleFilterChange,
  onSeverityFilterChange,
}: OverviewFilterPanelProps) {
  return (
    <section className="grid gap-3 rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-2))] p-4 md:grid-cols-3">
      <label className="space-y-2 text-sm">
        <span className="block text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
          Workspace
        </span>
        <select
          aria-label="Workspace filter"
          className="h-10 w-full rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel))] px-3 text-sm text-[hsl(var(--fg))] outline-none"
          value={workspaceFilter}
          onChange={(event) => onWorkspaceFilterChange(event.target.value)}
        >
          <option value="all">all workspaces</option>
          {workspaceOptions.map((workspace) => (
            <option key={workspace} value={workspace}>
              {workspace}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-2 text-sm">
        <span className="block text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
          Role
        </span>
        <select
          aria-label="Role filter"
          className="h-10 w-full rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel))] px-3 text-sm text-[hsl(var(--fg))] outline-none"
          value={roleFilter}
          onChange={(event) => onRoleFilterChange(event.target.value)}
        >
          <option value="all">all roles</option>
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-2 text-sm">
        <span className="block text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted))]">
          Status
        </span>
        <select
          aria-label="Status filter"
          className="h-10 w-full rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel))] px-3 text-sm text-[hsl(var(--fg))] outline-none"
          value={severityFilter}
          onChange={(event) => onSeverityFilterChange(event.target.value)}
        >
          <option value="all">all severities</option>
          <option value="normal">normal</option>
          <option value="warning">warning</option>
          <option value="critical">critical</option>
        </select>
      </label>
    </section>
  );
}
