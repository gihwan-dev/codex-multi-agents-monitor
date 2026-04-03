interface CausalInspectorJumpButtonProps {
  description: string;
  label: string;
  onClick: () => void;
}

export function CausalInspectorJumpButton({
  description,
  label,
  onClick,
}: CausalInspectorJumpButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid gap-1 rounded-[10px] border border-white/8 bg-white/[0.02] px-3 py-2 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-active)]/45"
      onClick={onClick}
    >
      <strong className="text-sm font-semibold">{label}</strong>
      <span className="text-[0.78rem] text-muted-foreground">{description}</span>
    </button>
  );
}
