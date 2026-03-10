import { Link } from "react-router-dom";

import { Button } from "@/shared/ui/button";

export function NotFoundPage() {
  return (
    <section className="flex h-full min-h-[360px] flex-col items-center justify-center gap-4 text-center">
      <p className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted))]">
        404
      </p>
      <h2 className="text-2xl font-semibold tracking-tight">Route not found</h2>
      <p className="max-w-lg text-sm text-[hsl(var(--muted))]">
        monitor 라우팅은 `/`, `/threads/:threadId`, `/history` 세 경로만 초기
        지원합니다.
      </p>
      <Link to="/">
        <Button size="sm">overview로 이동</Button>
      </Link>
    </section>
  );
}
