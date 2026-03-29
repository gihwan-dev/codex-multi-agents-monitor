interface MonitorContextMetricLabelProps {
  label: string;
  value: string;
}

export function MonitorContextMetricLabel({
  label,
  value,
}: MonitorContextMetricLabelProps) {
  return (
    <div className="grid gap-0.5 rounded-[var(--radius-soft)] border border-white/8 bg-black/10 px-3 py-2">
      <span>{label}</span>
      <strong className="text-sm text-foreground">{value}</strong>
    </div>
  );
}
