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
  const rowIds = Array.from({ length: rowCount }, (_, position) => `${title}-row-${position + 1}`);

  return (
    <div className="grid gap-2" aria-hidden="true">
      {rowIds.map((rowId, index) => (
        <div
          key={rowId}
          className={cn(
            "h-8 rounded-md bg-white/[0.04] motion-safe:animate-pulse motion-reduce:animate-none",
            SKELETON_WIDTHS[index % SKELETON_WIDTHS.length] ?? SKELETON_WIDTHS[0],
          )}
        />
      ))}
    </div>
  );
}
