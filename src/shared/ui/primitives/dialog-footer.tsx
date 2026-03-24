"use client"

import { Dialog as DialogPrimitive } from "radix-ui"
import type * as React from "react"

import { cn } from "../../lib"
import { Button } from "./button"

type DialogFooterProps = React.ComponentProps<"div"> & { showCloseButton?: boolean }

export function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: DialogFooterProps) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    >
      {children}
      {showCloseButton ? (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      ) : null}
    </div>
  )
}
