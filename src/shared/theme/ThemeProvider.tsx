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

export function ThemeProvider({ children, preferenceOverride }: ThemeProviderProps) {
  const [storedPreference, setStoredPreference] = useState<ThemePreference>(() =>
    readStoredThemePreference(),
  );
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());
  const preference = preferenceOverride ?? storedPreference;
  const resolvedTheme = preference === "system" ? systemTheme : preference;

  useEffect(() => {
    if (preferenceOverride !== undefined) {
      return;
    }

    persistThemePreference(storedPreference);
  }, [preferenceOverride, storedPreference]);

  useEffect(() => {
    applyResolvedThemeToDocument(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    const mediaQuery = getThemeMediaQuery();
    if (!mediaQuery) {
      return undefined;
    }

    const syncSystemTheme = (matches: boolean) => {
      setSystemTheme(matches ? "dark" : "light");
    };

    syncSystemTheme(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      syncSystemTheme(event.matches);
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
  }, []);

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
