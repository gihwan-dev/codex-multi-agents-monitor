import type { RefObject } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../shared/ui/primitives";

interface MonitorShortcutsDialogProps {
  open: boolean;
  onToggle: () => void;
  shortcutTriggerRef: RefObject<HTMLElement | null>;
}

export function MonitorShortcutsDialog({
  open,
  onToggle,
  shortcutTriggerRef,
}: MonitorShortcutsDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen !== open) {
          onToggle();
        }
      }}
    >
      <DialogContent
        aria-label="Keyboard shortcuts"
        className="max-w-[22rem] border-[color:var(--color-chrome-border)] text-foreground"
        style={{ background: "var(--gradient-dialog-surface)" }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          shortcutTriggerRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Shortcut help</DialogTitle>
          <DialogDescription>
            Keep the graph flow in view without leaving the keyboard.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2 pl-5 text-sm text-muted-foreground">
          <li>`/` search focus</li>
          <li>`I` inspector toggle</li>
          <li>`.` follow live</li>
          <li>`?` shortcuts help</li>
          <li>`Cmd/Ctrl + K` shortcuts help</li>
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onToggle}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
