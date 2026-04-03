import type { ReactNode } from "react";

export function SessionScoreSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-[0.76rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}
