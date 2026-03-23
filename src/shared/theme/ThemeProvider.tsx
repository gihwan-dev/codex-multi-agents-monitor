import { createContext, type PropsWithChildren, useContext, useEffect, useState } from "react";
import {
  applyResolvedThemeToDocument,
  getSystemTheme,
  getThemeMediaQuery,
  persistThemePreference,
  type ResolvedTheme,
  readStoredThemePreference,
  type ThemePreference,
} from "./dom";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps extends PropsWithChildren {
  preferenceOverride?: ThemePreference;
}

function resolveThemePreference(
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
  const handleChange = (event: MediaQueryListEvent) => {
    onChange(event.matches);
  };

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }

  mediaQuery.addListener(handleChange);
  return () => {
    mediaQuery.removeListener(handleChange);
  };
}

function useStoredThemePreference() {
  return useState<ThemePreference>(() => readStoredThemePreference());
}

function useSystemTheme() {
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  useEffect(() => {
    const mediaQuery = getThemeMediaQuery();
    if (!mediaQuery) {
      return undefined;
    }

    const syncSystemTheme = (matches: boolean) => {
      setSystemTheme(matches ? "dark" : "light");
    };

    syncSystemTheme(mediaQuery.matches);
    return subscribeToThemeChanges(mediaQuery, syncSystemTheme);
  }, []);

  return systemTheme;
}

function usePersistedThemePreference(
  preferenceOverride: ThemePreference | undefined,
  storedPreference: ThemePreference,
) {
  useEffect(() => {
    if (preferenceOverride !== undefined) {
      return;
    }

    persistThemePreference(storedPreference);
  }, [preferenceOverride, storedPreference]);
}

function useResolvedTheme(preference: ThemePreference) {
  const systemTheme = useSystemTheme();
  const resolvedTheme = resolveThemeValue(preference, systemTheme);

  useEffect(() => {
    applyResolvedThemeToDocument(resolvedTheme);
  }, [resolvedTheme]);

  return resolvedTheme;
}

export function ThemeProvider({ children, preferenceOverride }: ThemeProviderProps) {
  const [storedPreference, setStoredPreference] = useStoredThemePreference();
  const preference = resolveThemePreference(preferenceOverride, storedPreference);
  const resolvedTheme = useResolvedTheme(preference);

  usePersistedThemePreference(preferenceOverride, storedPreference);

  const setPreference = (nextPreference: ThemePreference) => {
    if (preferenceOverride !== undefined) {
      return;
    }

    setStoredPreference(nextPreference);
  };

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider.");
  }

  return context;
}
