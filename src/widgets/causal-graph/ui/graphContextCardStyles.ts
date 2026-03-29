export const CARD_BORDER_CLASS_NAMES = {
  danger: "border-[color:var(--color-failed)]/30",
  warning: "border-[color:var(--color-waiting)]/30",
  default: "border-white/10",
} as const;

export const BAR_FILL_CLASS_NAMES = {
  danger: "bg-[color:var(--color-failed)]",
  warning: "bg-[color:var(--color-waiting)]",
  default: "bg-[color:var(--color-active)]",
} as const;

export const CHANGE_PILL_CLASS_NAMES = {
  danger:
    "border-[color:var(--color-failed)]/30 bg-[color:color-mix(in_srgb,var(--color-failed)_14%,transparent)] text-[var(--color-failed)]",
  warning:
    "border-[color:var(--color-waiting)]/30 bg-[color:color-mix(in_srgb,var(--color-waiting)_14%,transparent)] text-[var(--color-waiting)]",
  success:
    "border-[color:var(--color-success)]/30 bg-[color:color-mix(in_srgb,var(--color-success)_14%,transparent)] text-[var(--color-success)]",
  default:
    "border-[color:var(--color-active)]/20 bg-[color:color-mix(in_srgb,var(--color-active)_12%,transparent)] text-[var(--color-active)]",
} as const;
