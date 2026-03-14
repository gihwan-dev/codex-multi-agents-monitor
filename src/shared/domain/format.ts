export function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function formatCurrency(costUsd: number): string {
  if (costUsd <= 0) {
    return "$0.00";
  }

  if (costUsd < 1) {
    return `$${costUsd.toFixed(2)}`;
  }

  return `$${costUsd.toFixed(2)}`;
}

export function formatCompactNumber(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return `${value}`;
}

export function formatTokens(tokens: number): string {
  if (tokens <= 0) {
    return "n/a";
  }

  return `${formatCompactNumber(tokens)} tok`;
}

export function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

export function truncateId(value: string): string {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 8)}…${value.slice(-3)}`;
}
