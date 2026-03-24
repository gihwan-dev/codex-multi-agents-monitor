import { Tabs as TabsPrimitive } from "radix-ui"
import type * as React from "react"

import { cn } from "../../lib"

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}
