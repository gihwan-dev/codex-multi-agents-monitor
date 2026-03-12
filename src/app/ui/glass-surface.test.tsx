import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GlassSurface } from "./glass-surface";
import { LiquidGlassProvider } from "./liquid-glass-provider";

function mockUserAgent(userAgent: string) {
  return vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(userAgent);
}

describe("GlassSurface", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps fx and content layers separate", () => {
    mockUserAgent(
      "Mozilla/5.0 AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    );

    const { container } = render(
      <LiquidGlassProvider>
        <GlassSurface refraction="soft" variant="panel">
          <span>Surface content</span>
        </GlassSurface>
      </LiquidGlassProvider>,
    );

    const surface = container.querySelector("[data-glass-surface]");
    const fxLayer = container.querySelector(".glass-surface__fx") as HTMLElement | null;
    const contentLayer = container.querySelector(".glass-surface__content");

    expect(surface).toHaveAttribute("data-variant", "panel");
    expect(surface).toHaveAttribute("data-refraction", "soft");
    expect(surface).toHaveAttribute("data-mode", "enhanced");
    expect(fxLayer).not.toBeNull();
    expect(contentLayer).not.toBeNull();
    expect(screen.getByText("Surface content")).toBeInTheDocument();
    expect(contentLayer).toContainElement(screen.getByText("Surface content"));
  });

  it("falls back to no refraction filter on Safari", () => {
    mockUserAgent(
      "Mozilla/5.0 AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15",
    );

    const { container } = render(
      <LiquidGlassProvider>
        <GlassSurface refraction="soft" variant="warning">
          <span>Fallback</span>
        </GlassSurface>
      </LiquidGlassProvider>,
    );

    const surface = container.querySelector("[data-glass-surface]");
    const fxLayer = container.querySelector(".glass-surface__fx") as HTMLElement | null;

    expect(surface).toHaveAttribute("data-variant", "warning");
    expect(surface).toHaveAttribute("data-mode", "fallback");
    expect(fxLayer?.style.getPropertyValue("--glass-refraction-filter")).toBe(
      "none",
    );
  });

  it("enables the soft refraction filter in Chromium", () => {
    mockUserAgent(
      "Mozilla/5.0 AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    );

    const { container } = render(
      <LiquidGlassProvider>
        <GlassSurface interactive refraction="soft" variant="danger">
          <span>Enhanced</span>
        </GlassSurface>
      </LiquidGlassProvider>,
    );

    const surface = container.querySelector("[data-glass-surface]");
    const fxLayer = container.querySelector(".glass-surface__fx") as HTMLElement | null;

    expect(surface).toHaveAttribute("data-variant", "danger");
    expect(surface).toHaveAttribute("data-interactive", "true");
    expect(fxLayer?.style.getPropertyValue("--glass-refraction-filter")).toContain(
      "url(#liquidGlassFilterSoft)",
    );
  });
});
