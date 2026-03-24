import { createContext, type PropsWithChildren, useContext } from "react";
import {
  type ResolvedTheme,
  type ThemePreference,
} from "./dom";
import {
  resolveThemePreference,
  usePersistedThemePreference,
  useResolvedTheme,
  useStoredThemePreference,
} from "./themeProviderHooks";

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
