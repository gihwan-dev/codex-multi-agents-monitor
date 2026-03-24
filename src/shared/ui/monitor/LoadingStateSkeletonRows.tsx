import { cn } from "../../lib";

const SKELETON_WIDTHS = ["w-[92%]", "w-[76%]", "w-[84%]"] as const;

interface LoadingSkeletonRowsProps {
  skeletonRows?: number;
  title: string;
}

export function LoadingSkeletonRows({ skeletonRows, title }: LoadingSkeletonRowsProps) {
  const rowCount = skeletonRows ?? 0;
  if (rowCount <= 0) {
    return null;
  }

  return (
    <div className="grid gap-2" aria-hidden="true">
      {Array.from({ length: rowCount }, (_, index) => (
        <div
          key={`${title}-row-${index + 1}`}
          className={cn(
            "h-8 rounded-md bg-white/[0.04] motion-safe:animate-pulse motion-reduce:animate-none",
            SKELETON_WIDTHS[index % SKELETON_WIDTHS.length] ?? SKELETON_WIDTHS[0],
          )}
        />
      ))}
    </div>
  );
}
