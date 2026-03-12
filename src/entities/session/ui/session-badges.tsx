import { Badge } from "@/components/ui/badge";

import type { SessionSummary } from "@/shared/queries";

import { statusBadgeVariant } from "../lib/presentation";

export function SessionBadges({ session }: { session: SessionSummary }) {
  return (
    <div className="mt-1.5 flex items-center gap-1.5" aria-label="session badges">
      <Badge
        variant={statusBadgeVariant(session.status)}
        className="h-4.5 border-white/10 !bg-white/[0.055] px-1.5 py-0 text-[9px] font-medium capitalize leading-tight tracking-[0.04em] !text-slate-200 shadow-none"
      >
        {session.status}
      </Badge>
      <span className="text-[10px] text-slate-500/86">
        {session.event_count} events
      </span>
    </div>
  );
}
