import { useEffect, useState } from "react";

import {
  applyResolvedThemeToDocument,
  getSystemTheme,
  getThemeMediaQuery,
  persistThemePreference,
  type ResolvedTheme,
  readStoredThemePreference,
  type ThemePreference,
} from "./dom";

export function resolveThemePreference(
  preferenceOverride: ThemePreference | undefined,
  storedPreference: ThemePreference,
) {
  return preferenceOverride ?? storedPreference;
}

function resolveThemeValue(
  preference: ThemePreference,
  systemTheme: ResolvedTheme,
): ResolvedTheme {
  return preference === "system" ? systemTheme : preference;
}

function subscribeToThemeChanges(
  mediaQuery: MediaQueryList,
  onChange: (matches: boolean) => void,
) {
  const handleChange = (event: MediaQueryListEvent) => onChange(event.matches);
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }

  mediaQuery.addListener(handleChange);
  return () => mediaQuery.removeListener(handleChange);
}

export function useStoredThemePreference() {
  return useState<ThemePreference>(() => readStoredThemePreference());
}

function useSystemTheme() {
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  useEffect(() => {
    const mediaQuery = getThemeMediaQuery();
    if (!mediaQuery) {
      return undefined;
    }

    const syncSystemTheme = (matches: boolean) => setSystemTheme(matches ? "dark" : "light");
    syncSystemTheme(mediaQuery.matches);
    return subscribeToThemeChanges(mediaQuery, syncSystemTheme);
  }, []);

  return systemTheme;
}

export function usePersistedThemePreference(
  preferenceOverride: ThemePreference | undefined,
  storedPreference: ThemePreference,
) {
  useEffect(() => {
    if (preferenceOverride === undefined) {
      persistThemePreference(storedPreference);
    }
  }, [preferenceOverride, storedPreference]);
}

export function useResolvedTheme(preference: ThemePreference) {
  const systemTheme = useSystemTheme();
  const resolvedTheme = resolveThemeValue(preference, systemTheme);

  useEffect(() => {
    applyResolvedThemeToDocument(resolvedTheme);
  }, [resolvedTheme]);

  return resolvedTheme;
}
