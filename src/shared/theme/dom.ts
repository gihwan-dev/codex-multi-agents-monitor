export const THEME_STORAGE_KEY = "codex-monitor-theme-preference";

export type ThemePreference = "system" | "dark" | "light";
export type ResolvedTheme = "dark" | "light";

const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

type MatchMediaSource = Pick<Window, "matchMedia">;

function getBrowserWindow(): Window | undefined {
  return typeof window === "undefined" ? undefined : window;
}

function getBrowserDocument(): Document | undefined {
  return typeof document === "undefined" ? undefined : document;
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "dark" || value === "light";
}

export function readStoredThemePreference(
  storage: Storage | undefined = getBrowserWindow()?.localStorage,
): ThemePreference {
  try {
    const storedPreference = storage?.getItem(THEME_STORAGE_KEY);
    return isThemePreference(storedPreference) ? storedPreference : "system";
  } catch {
    return "system";
  }
}

export function persistThemePreference(
  preference: ThemePreference,
  storage: Storage | undefined = getBrowserWindow()?.localStorage,
): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Local storage can be unavailable in locked-down browser contexts.
  }
}

export function getSystemTheme(
  matchMediaSource: MatchMediaSource | undefined = getBrowserWindow(),
): ResolvedTheme {
  if (!matchMediaSource?.matchMedia) {
    return "dark";
  }

  return matchMediaSource.matchMedia(DARK_MEDIA_QUERY).matches ? "dark" : "light";
}

export function resolveThemePreference(
  preference: ThemePreference,
  matchMediaSource: MatchMediaSource | undefined = getBrowserWindow(),
): ResolvedTheme {
  return preference === "system" ? getSystemTheme(matchMediaSource) : preference;
}

export function getThemeMediaQuery(
  matchMediaSource: MatchMediaSource | undefined = getBrowserWindow(),
): MediaQueryList | null {
  if (!matchMediaSource?.matchMedia) {
    return null;
  }

  return matchMediaSource.matchMedia(DARK_MEDIA_QUERY);
}

export function applyResolvedThemeToDocument(
  resolvedTheme: ResolvedTheme,
  targetDocument: Document | undefined = getBrowserDocument(),
): void {
  if (!targetDocument) {
    return;
  }

  targetDocument.documentElement.dataset.theme = resolvedTheme;
  if (targetDocument.body) {
    targetDocument.body.dataset.theme = resolvedTheme;
  }
}

export function applyThemePreferenceToDocument(
  preference: ThemePreference,
  options: {
    document?: Document;
    matchMediaSource?: MatchMediaSource;
  } = {},
): ResolvedTheme {
  const resolvedTheme = resolveThemePreference(preference, options.matchMediaSource);
  applyResolvedThemeToDocument(resolvedTheme, options.document);
  return resolvedTheme;
}

export function initializeThemeDocument(
  options: {
    document?: Document;
    matchMediaSource?: MatchMediaSource;
    storage?: Storage;
  } = {},
): { preference: ThemePreference; resolvedTheme: ResolvedTheme } {
  const preference = readStoredThemePreference(options.storage);
  const resolvedTheme = applyThemePreferenceToDocument(preference, options);
  return { preference, resolvedTheme };
}
