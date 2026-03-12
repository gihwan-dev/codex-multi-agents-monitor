import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GlassSurface } from "./glass-surface";
import { LiquidGlassProvider } from "./liquid-glass-provider";

function mockUserAgent(userAgent: string) {
  return vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(userAgent);
}

describe("GlassSurface 컴포넌트", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("fx 레이어와 콘텐츠 레이어를 분리한다", () => {
    mockUserAgent(
      "Mozilla/5.0 AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    );

    const { container } = render(
      <LiquidGlassProvider>
        <GlassSurface interactive refraction="soft" variant="panel">
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
    expect(surface).toHaveAttribute("data-refraction-active", "true");
    expect(fxLayer).not.toBeNull();
    expect(contentLayer).not.toBeNull();
    expect(screen.getByText("Surface content")).toBeInTheDocument();
    expect(contentLayer).toContainElement(screen.getByText("Surface content"));
  });

  it("Safari에서는 soft refraction을 fallback으로 유지한다", () => {
    mockUserAgent(
      "Mozilla/5.0 AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15",
    );

    const { container } = render(
      <LiquidGlassProvider>
        <GlassSurface interactive refraction="soft" variant="panel">
          <span>Fallback</span>
        </GlassSurface>
      </LiquidGlassProvider>,
    );

    const surface = container.querySelector("[data-glass-surface]");
    const fxLayer = container.querySelector(".glass-surface__fx") as HTMLElement | null;

    expect(surface).toHaveAttribute("data-variant", "panel");
    expect(surface).toHaveAttribute("data-mode", "fallback");
    expect(surface).toHaveAttribute("data-refraction-active", "false");
    expect(fxLayer?.style.getPropertyValue("--glass-refraction-filter")).toBe(
      "none",
    );
  });

  it("Chromium의 interactive panel에서만 soft refraction을 활성화한다", () => {
    mockUserAgent(
      "Mozilla/5.0 AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    );

    const { container } = render(
      <LiquidGlassProvider>
        <GlassSurface interactive refraction="soft" variant="panel">
          <span>Enhanced</span>
        </GlassSurface>
      </LiquidGlassProvider>,
    );

    const surface = container.querySelector("[data-glass-surface]");
    const fxLayer = container.querySelector(".glass-surface__fx") as HTMLElement | null;

    expect(surface).toHaveAttribute("data-variant", "panel");
    expect(surface).toHaveAttribute("data-interactive", "true");
    expect(surface).toHaveAttribute("data-refraction-active", "true");
    expect(fxLayer?.style.getPropertyValue("--glass-refraction-filter")).toContain(
      "url(#liquidGlassFilterSoft)",
    );
  });

  it("interactive여도 toolbar는 refraction 대상이 아니다", () => {
    mockUserAgent(
      "Mozilla/5.0 AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    );

    const { container } = render(
      <LiquidGlassProvider>
        <GlassSurface interactive refraction="soft" variant="toolbar">
          <span>Toolbar</span>
        </GlassSurface>
      </LiquidGlassProvider>,
    );

    const surface = container.querySelector("[data-glass-surface]");
    const fxLayer = container.querySelector(".glass-surface__fx") as HTMLElement | null;

    expect(surface).toHaveAttribute("data-variant", "toolbar");
    expect(surface).toHaveAttribute("data-refraction-active", "false");
    expect(fxLayer?.style.getPropertyValue("--glass-refraction-filter")).toBe(
      "none",
    );
  });

  it("Chromium의 interactive control에서도 soft refraction을 활성화한다", () => {
    mockUserAgent(
      "Mozilla/5.0 AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    );

    const { container } = render(
      <LiquidGlassProvider>
        <GlassSurface interactive refraction="soft" variant="control">
          <span>Control</span>
        </GlassSurface>
      </LiquidGlassProvider>,
    );

    const surface = container.querySelector("[data-glass-surface]");
    const fxLayer = container.querySelector(".glass-surface__fx") as HTMLElement | null;

    expect(surface).toHaveAttribute("data-variant", "control");
    expect(surface).toHaveAttribute("data-refraction-active", "true");
    expect(fxLayer?.style.getPropertyValue("--glass-refraction-filter")).toContain(
      "url(#liquidGlassFilterSoft)",
    );
  });
});
