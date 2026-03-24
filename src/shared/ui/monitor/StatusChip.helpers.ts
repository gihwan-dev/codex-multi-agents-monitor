import type { CSSProperties } from "react";

import { cn } from "../../lib";

export function buildStatusChipStyle(tone: string, subtle: boolean): CSSProperties {
  return subtle
    ? { color: "var(--color-text-secondary)" }
    : {
        borderColor: `color-mix(in srgb, ${tone} 35%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${tone} 12%, var(--color-surface-raised))`,
        color: "var(--color-text)",
      };
}

export function buildStatusChipClassName(subtle: boolean, className?: string) {
  return cn(
    "inline-flex w-fit items-center gap-2 rounded-full font-medium",
    subtle ? "border-transparent bg-transparent px-0 py-0 text-[0.72rem]" : "border px-2.5 py-1 text-[0.8rem]",
    className,
  );
}
