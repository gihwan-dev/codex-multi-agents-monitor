// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY, ThemeProvider, useTheme } from "../src/shared/theme/index.js";

const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

let container: HTMLDivElement;
let root: Root;

function installMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: DARK_MEDIA_QUERY,
    onchange: null,
    addEventListener: (_event: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === "function") {
        listeners.add(listener as (event: MediaQueryListEvent) => void);
      }
    },
    removeEventListener: (_event: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === "function") {
        listeners.delete(listener as (event: MediaQueryListEvent) => void);
      }
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => true,
  } as unknown as MediaQueryList;

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => {
      if (query !== DARK_MEDIA_QUERY) {
        throw new Error(`Unexpected media query: ${query}`);
      }

      return mediaQueryList;
    },
  });

  return {
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      const event = { matches: nextMatches, media: DARK_MEDIA_QUERY } as MediaQueryListEvent;
      listeners.forEach((listener) => {
        listener(event);
      });
    },
  };
}

function ThemeProbe() {
  const { preference, resolvedTheme, setPreference } = useTheme();

  return (
    <div>
      <output data-slot="theme-preference">{preference}</output>
      <output data-slot="resolved-theme">{resolvedTheme}</output>
      <button type="button" onClick={() => setPreference("system")}>
        System
      </button>
      <button type="button" onClick={() => setPreference("dark")}>
        Dark
      </button>
      <button type="button" onClick={() => setPreference("light")}>
        Light
      </button>
    </div>
  );
}

async function renderThemeProbe() {
  await act(async () => {
    root.render(createElement(ThemeProvider, null, createElement(ThemeProbe)));
  });
}

function getPreferenceOutput() {
  return container.querySelector('[data-slot="theme-preference"]')?.textContent;
}

function getResolvedThemeOutput() {
  return container.querySelector('[data-slot="resolved-theme"]')?.textContent;
}

function clickThemeButton(label: "System" | "Dark" | "Light") {
  const button = Array.from(container.querySelectorAll("button")).find(
    (item) => item.textContent?.trim() === label,
  );

  if (!button) {
    throw new Error(`${label} button missing`);
  }

  return act(async () => {
    button.click();
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.body.dataset.theme;
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.body.dataset.theme;
});

describe("ThemeProvider", () => {
  it("saved preferences override the operating system theme", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    installMatchMedia(true);

    await renderThemeProbe();

    expect(getPreferenceOutput()).toBe("light");
    expect(getResolvedThemeOutput()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.body.dataset.theme).toBe("light");
  });

  it("falls back to system mode when storage contains an invalid value", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    installMatchMedia(true);

    await renderThemeProbe();

    expect(getPreferenceOutput()).toBe("system");
    expect(getResolvedThemeOutput()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("resolves system mode from prefers-color-scheme and follows live OS changes", async () => {
    const matchMediaController = installMatchMedia(false);

    await renderThemeProbe();

    expect(getPreferenceOutput()).toBe("system");
    expect(getResolvedThemeOutput()).toBe("light");

    await act(async () => {
      matchMediaController.setMatches(true);
    });

    expect(getResolvedThemeOutput()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("ignores OS changes for explicit themes and re-resolves when switching back to system", async () => {
    const matchMediaController = installMatchMedia(true);

    await renderThemeProbe();
    await clickThemeButton("Light");

    expect(getPreferenceOutput()).toBe("light");
    expect(getResolvedThemeOutput()).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    await act(async () => {
      matchMediaController.setMatches(false);
    });

    expect(getResolvedThemeOutput()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");

    await clickThemeButton("System");

    expect(getPreferenceOutput()).toBe("system");
    expect(getResolvedThemeOutput()).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });
});
