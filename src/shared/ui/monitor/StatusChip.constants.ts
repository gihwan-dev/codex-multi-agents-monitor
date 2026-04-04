export const STATUS_LABELS = {
  queued: "Queued",
  running: "Running",
  waiting: "Waiting",
  blocked: "Blocked",
  interrupted: "Interrupted",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
  stale: "Stale",
  disconnected: "Disconnected",
} as const;

export type StatusChipStatus = keyof typeof STATUS_LABELS;

export type StatusGlyphShape =
  | "filled-circle"
  | "hollow-circle"
  | "slashed-circle"
  | "diamond"
  | "small-filled-circle";

export const STATUS_GLYPH_SHAPES = {
  queued: "hollow-circle",
  running: "filled-circle",
  waiting: "hollow-circle",
  blocked: "slashed-circle",
  interrupted: "slashed-circle",
  done: "small-filled-circle",
  failed: "diamond",
  cancelled: "small-filled-circle",
  stale: "hollow-circle",
  disconnected: "hollow-circle",
} as const satisfies Record<StatusChipStatus, StatusGlyphShape>;

export const STATUS_COLORS = {
  queued: "var(--color-text-tertiary)",
  running: "var(--color-active)",
  waiting: "var(--color-waiting)",
  blocked: "var(--color-blocked)",
  interrupted: "var(--color-transfer)",
  done: "var(--color-success)",
  failed: "var(--color-failed)",
  cancelled: "var(--color-text-tertiary)",
  stale: "var(--color-stale)",
  disconnected: "var(--color-disconnected)",
} as const;

export const STATUS_GLYPH_CLASS_NAMES = {
  "filled-circle": {
    regular: "block size-full rounded-full bg-current",
    compact: "block size-full rounded-full bg-current",
  },
  "hollow-circle": {
    regular: "block size-full rounded-full border-2 border-current bg-transparent",
    compact: "block size-full rounded-full border-2 border-current bg-transparent",
  },
  "slashed-circle": {
    regular:
      "relative block size-full rounded-full border-2 border-current bg-transparent after:absolute after:left-1/2 after:top-1/2 after:h-[2px] after:w-[140%] after:-translate-x-1/2 after:-translate-y-1/2 after:-rotate-45 after:rounded-full after:bg-current after:content-['']",
    compact:
      "relative block size-full rounded-full border-2 border-current bg-transparent after:absolute after:left-1/2 after:top-1/2 after:h-[2px] after:w-[140%] after:-translate-x-1/2 after:-translate-y-1/2 after:-rotate-45 after:rounded-full after:bg-current after:content-['']",
  },
  diamond: {
    regular: "block size-2 rotate-45 bg-current",
    compact: "block size-1.5 rotate-45 bg-current",
  },
  "small-filled-circle": {
    regular: "block size-1.5 rounded-full bg-current",
    compact: "block size-1.5 rounded-full bg-current",
  },
} as const satisfies Record<
  StatusGlyphShape,
  { regular: string; compact: string }
>;
