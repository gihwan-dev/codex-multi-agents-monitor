export function HiddenLaneNotice({ hiddenLaneCount }: { hiddenLaneCount: number }) {
  return hiddenLaneCount ? (
    <p className="text-[0.8rem] text-muted-foreground">
      {hiddenLaneCount} inactive done lanes are folded to preserve the active path.
    </p>
  ) : null;
}
