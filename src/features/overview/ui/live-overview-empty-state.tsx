import { SearchX } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/shared/ui/button";

export function LiveOverviewEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-[hsl(var(--line-strong))] bg-[hsl(var(--panel-2)/0.7)] p-8 text-center">
      <SearchX className="mx-auto mb-3 text-[hsl(var(--muted))]" />
      <p className="text-sm text-[hsl(var(--muted))]">
        inflight thread가 없습니다. `~/.codex/sessions`가 비어 있어도 앱은
        정상입니다.
      </p>
      <div className="mt-4">
        <Link to="/history">
          <Button variant="ghost" size="sm">
            최근 히스토리 보기
          </Button>
        </Link>
      </div>
    </div>
  );
}
