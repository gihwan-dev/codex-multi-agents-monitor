import { describe, expect, it } from "vitest";

import { detectLiquidGlassMode } from "./liquid-glass-runtime";

describe("detectLiquidGlassMode", () => {
  it("returns enhanced for Chromium-based browsers", () => {
    expect(
      detectLiquidGlassMode(
        "Mozilla/5.0 AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
      ),
    ).toBe("enhanced");
    expect(
      detectLiquidGlassMode(
        "Mozilla/5.0 AppleWebKit/537.36 Edg/124.0.2478.51 Safari/537.36",
      ),
    ).toBe("enhanced");
    expect(
      detectLiquidGlassMode(
        "Mozilla/5.0 AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
      ),
    ).toBe("enhanced");
  });

  it("returns fallback for Firefox and WebKit-only runtimes", () => {
    expect(
      detectLiquidGlassMode(
        "Mozilla/5.0 Gecko/20100101 Firefox/124.0",
      ),
    ).toBe("fallback");
    expect(
      detectLiquidGlassMode(
        "Mozilla/5.0 AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15",
      ),
    ).toBe("fallback");
  });
});
