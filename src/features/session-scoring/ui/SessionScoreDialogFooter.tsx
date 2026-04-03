import { Button, DialogFooter } from "../../../shared/ui/primitives";

export function SessionScoreDialogFooter({
  disabled,
  onClose,
  onSave,
  pending,
}: {
  disabled: boolean;
  onClose: () => void;
  onSave: () => void;
  pending: boolean;
}) {
  return (
    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        className="border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
        onClick={onClose}
        disabled={pending}
      >
        Cancel
      </Button>
      <Button type="button" onClick={onSave} disabled={disabled}>
        {pending ? "Saving…" : "Save score"}
      </Button>
    </DialogFooter>
  );
}
