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

export function ThemeProvider({ children }: PropsWithChildren) {
  const [preference, setPreference] = useState<ThemePreference>(() => readStoredThemePreference());
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());
  const resolvedTheme = preference === "system" ? systemTheme : preference;

  useEffect(() => {
    persistThemePreference(preference);
  }, [preference]);

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
