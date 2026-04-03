import { Button } from "../../../shared/ui/primitives";

interface MonitorDrawerCloseActionProps {
  onCloseDrawer: () => void;
}

export function MonitorDrawerCloseAction({
  onCloseDrawer,
}: MonitorDrawerCloseActionProps) {
  return (
    <Button type="button" variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.06]" aria-label="Close drawer" onClick={onCloseDrawer}>
      Close
    </Button>
  );
}
