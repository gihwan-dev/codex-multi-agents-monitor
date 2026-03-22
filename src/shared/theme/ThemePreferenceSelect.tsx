import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/primitives";
import { isThemePreference } from "./dom";
import { useTheme } from "./ThemeProvider";

const THEME_OPTIONS = [
  { label: "System", value: "system" },
  { label: "Dark", value: "dark" },
  { label: "Light", value: "light" },
] as const;

export function ThemePreferenceSelect() {
  const { preference, setPreference } = useTheme();

  return (
    <Select
      value={preference}
      onValueChange={(value) => {
        if (isThemePreference(value)) {
          setPreference(value);
        }
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label="Theme"
        className="min-w-[10.5rem] border-[color:var(--color-chrome-border)] bg-[color:var(--color-surface-tint)] text-foreground hover:bg-[color:var(--color-surface-hover)]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-[0.68rem] uppercase tracking-[0.05em] text-muted-foreground">
            Theme
          </span>
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent className="min-w-[10.5rem]">
        {THEME_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
