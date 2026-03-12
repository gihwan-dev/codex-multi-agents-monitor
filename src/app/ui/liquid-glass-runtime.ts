export type LiquidGlassMode = "enhanced" | "fallback";

const CHROMIUM_RUNTIME_PATTERN = /chrome|chromium|crios|edg|edga|edgios/i;
const FIREFOX_RUNTIME_PATTERN = /firefox|fxios/i;
const WEBKIT_ONLY_PATTERN = /applewebkit/i;

export function detectLiquidGlassMode(userAgent: string): LiquidGlassMode {
  if (FIREFOX_RUNTIME_PATTERN.test(userAgent)) {
    return "fallback";
  }

  const hasChromiumToken = CHROMIUM_RUNTIME_PATTERN.test(userAgent);
  const isWebKitOnly =
    WEBKIT_ONLY_PATTERN.test(userAgent) && !hasChromiumToken;

  if (isWebKitOnly) {
    return "fallback";
  }

  return hasChromiumToken ? "enhanced" : "fallback";
}

export function getRuntimeLiquidGlassMode(): LiquidGlassMode {
  if (typeof window === "undefined") {
    return "fallback";
  }

  return detectLiquidGlassMode(window.navigator.userAgent);
}
