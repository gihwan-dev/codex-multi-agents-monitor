interface ProviderBadge {
  className: string;
  label: string;
  short: string;
}

const PROVIDER_BADGES: Record<string, ProviderBadge> = {
  claude: {
    label: "Claude Code",
    short: "CC",
    className: "border-amber-400/20 bg-amber-500/10 text-amber-100",
  },
  codex: {
    label: "Codex",
    short: "CX",
    className: "border-sky-400/20 bg-sky-500/10 text-sky-100",
  },
};

export function resolveProviderBadge(provider: string | null) {
  const normalized = provider?.trim().toLowerCase();
  return normalized ? PROVIDER_BADGES[normalized] ?? null : null;
}
