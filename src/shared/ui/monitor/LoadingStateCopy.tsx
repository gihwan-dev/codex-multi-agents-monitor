import { cn } from "../../lib";

interface LoadingCopyProps {
  compact?: boolean;
  message: string;
  title: string;
}

export function LoadingCopy({ compact, message, title }: LoadingCopyProps) {
  return (
    <div className="grid gap-1">
      <h3 className={cn("text-sm font-semibold tracking-[0.01em] text-foreground", compact && "text-[0.82rem]")}>{title}</h3>
      <p className={cn("text-sm leading-6 text-muted-foreground", compact && "text-[0.76rem] leading-5")}>{message}</p>
    </div>
  );
}
