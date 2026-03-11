import { Link } from "react-router-dom";

import { formatDuration } from "@/features/overview/lib/live-overview-formatters";
import type { SessionListItem, SessionScope } from "@/shared/types/contracts";

type SessionListCardProps = {
  scope: SessionScope;
  session: SessionListItem;
  isSelected: boolean;
  activeWorkspace: string | null;
};

export function SessionListCard({
  scope,
  session,
  isSelected,
  activeWorkspace,
}: SessionListCardProps) {
  return (
    <Link
      className={`block rounded-2xl border px-3 py-3 text-sm transition-colors ${
        isSelected
          ? "border-[hsl(var(--accent-strong))] bg-[hsl(var(--panel)/0.84)]"
          : "border-[hsl(var(--line))] hover:border-[hsl(var(--line-strong))]"
      }`}
      to={`/${scope}/${session.session_id}${activeWorkspace ? `?workspace=${encodeURIComponent(activeWorkspace)}` : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{session.title}</div>
          <div className="mt-1 text-xs text-[hsl(var(--muted))]">
            {session.workspace}
          </div>
        </div>
        <span className="rounded-full border border-[hsl(var(--line))] px-2 py-1 text-[11px] text-[hsl(var(--muted))]">
          {session.status}
        </span>
      </div>
      <p className="mt-2 text-xs text-[hsl(var(--muted))]">
        {session.latest_activity_summary ?? "latest activity summary 없음"}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[hsl(var(--muted))]">
        <span>{session.agent_roles.join(", ") || "role 없음"}</span>
        <span>{renderSecondaryMetric(scope, session)}</span>
      </div>
    </Link>
  );
}

function renderSecondaryMetric(scope: SessionScope, session: SessionListItem) {
  if (scope === "archive") {
    return session.rollout_path ?? "rollout 없음";
  }
  return session.longest_wait_ms !== null
    ? `wait ${formatDuration(session.longest_wait_ms)}`
    : "active wait 없음";
}
