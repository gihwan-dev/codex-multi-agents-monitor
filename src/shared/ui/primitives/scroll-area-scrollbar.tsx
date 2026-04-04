import { ScrollArea as ScrollAreaPrimitive } from "radix-ui"
import type * as React from "react"

import { cn } from "../../lib"

export function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none p-px select-none",
        "opacity-0 transition-opacity motion-reduce:transition-none duration-150",
        "group-hover/scroll-area:opacity-100 group-focus-within/scroll-area:opacity-100",
        orientation === "vertical" && "h-full w-1.5 border-l border-l-transparent",
        orientation === "horizontal" && "h-1.5 flex-col border-t border-t-transparent",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border/40 transition-colors motion-reduce:transition-none hover:bg-border/60"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}
