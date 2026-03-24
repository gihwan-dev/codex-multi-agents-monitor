function formatSubMinuteDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }

  return `${Math.round(durationMs / 1000)}s`;
}

function formatMinuteDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function formatHourDuration(totalSeconds: number): string {
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}h ${totalMinutes % 60}m`;
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds < 60) {
    return formatSubMinuteDuration(durationMs);
  }
  if (totalSeconds < 3600) {
    return formatMinuteDuration(totalSeconds);
  }
  return formatHourDuration(totalSeconds);
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

export function formatRelativeTime(
  timestamp: number,
  referenceTimestamp = Date.now(),
): string {
  const absoluteSeconds = Math.abs(Math.round((timestamp - referenceTimestamp) / 1000));
  if (absoluteSeconds < 10) return "now";
  if (absoluteSeconds < 60) return `${absoluteSeconds}s`;
  return formatExtendedRelativeTime(absoluteSeconds);
}

function formatExtendedRelativeTime(absoluteSeconds: number): string {
  const absoluteMinutes = Math.round(absoluteSeconds / 60);
  if (absoluteMinutes < 60) return `${absoluteMinutes}m`;

  const absoluteHours = Math.round(absoluteMinutes / 60);
  if (absoluteHours < 24) return `${absoluteHours}h`;

  return `${Math.round(absoluteHours / 24)}d`;
}

export function truncateId(value: string): string {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 8)}…${value.slice(-3)}`;
}
