import { Badge } from "@/components/ui/badge";

import type { SessionSummary } from "@/shared/queries";

import { statusBadgeVariant } from "../lib/presentation";

export function SessionBadges({ session }: { session: SessionSummary }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1" aria-label="session badges">
      <Badge
        variant={statusBadgeVariant(session.status)}
        className="px-1.5 py-0 text-[10px] font-mono leading-tight"
      >
        {session.status}
      </Badge>
      <Badge
        variant="outline"
        className="border-white/10 px-1.5 py-0 text-[10px] font-mono leading-tight text-muted-foreground"
      >
        {session.is_archived ? "archived" : "active"}
      </Badge>
      <Badge
        variant="secondary"
        className="px-1.5 py-0 text-[10px] font-mono leading-tight"
      >
        {session.event_count} evts
      </Badge>
    </div>
  );
}
