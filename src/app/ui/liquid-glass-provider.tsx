import * as React from "react";

import {
  getRuntimeLiquidGlassMode,
  type LiquidGlassMode,
} from "@/app/ui/liquid-glass-runtime";

const LiquidGlassContext = React.createContext<LiquidGlassMode>("fallback");

const DISPLACEMENT_MAP_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" version="1.1" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="redGradient" x1="0" x2="1" y1="0" y2="0" color-interpolation="sRGB" gradientUnits="objectBoundingBox">
        <stop offset="0%" stop-color="rgb(255,0,0)" stop-opacity="1" />
        <stop offset="6%" stop-color="rgb(255,0,0)" stop-opacity="0.68" />
        <stop offset="94%" stop-color="rgb(255,0,0)" stop-opacity="0.32" />
        <stop offset="100%" stop-color="rgb(255,0,0)" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="blueGradient" x1="0" x2="0" y1="0" y2="1" color-interpolation="sRGB" gradientUnits="objectBoundingBox">
        <stop offset="0%" stop-color="rgb(0,0,255)" stop-opacity="1" />
        <stop offset="6%" stop-color="rgb(0,0,255)" stop-opacity="0.68" />
        <stop offset="94%" stop-color="rgb(0,0,255)" stop-opacity="0.32" />
        <stop offset="100%" stop-color="rgb(0,0,255)" stop-opacity="0" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" fill="black" />
    <rect width="100" height="100" fill="url(#redGradient)" style="mix-blend-mode:lighten" />
    <rect width="100" height="100" fill="url(#blueGradient)" style="mix-blend-mode:lighten" />
  </svg>
`)}`;

function LiquidGlassDefs() {
  return (
    <svg
      aria-hidden="true"
      height={0}
      preserveAspectRatio="none"
      style={{ display: "none" }}
      version="1.1"
      width={0}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter
          colorInterpolationFilters="sRGB"
          filterUnits="objectBoundingBox"
          id="liquidGlassFilterSoft"
          x="-18%"
          y="-18%"
          width="136%"
          height="136%"
        >
          <feImage href={DISPLACEMENT_MAP_DATA_URL} result="paneWarpMap" />
          <feTurbulence
            baseFrequency="0.003 0.006"
            numOctaves="2"
            result="noise"
            seed="7"
            stitchTiles="stitch"
            type="turbulence"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            result="rippled"
            scale="4"
          />
          <feDisplacementMap
            in="rippled"
            in2="paneWarpMap"
            result="displaced"
            scale="10"
            xChannelSelector="R"
            yChannelSelector="B"
          />
          <feColorMatrix
            in="displaced"
            result="red"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
          />
          <feOffset dx="0.7" dy="0" in="red" result="shiftedRed" />
          <feColorMatrix
            in="displaced"
            result="green"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
          />
          <feOffset dx="0" dy="0.7" in="green" result="shiftedGreen" />
          <feColorMatrix
            in="displaced"
            result="blue"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
          />
          <feOffset dx="-0.7" dy="0" in="blue" result="shiftedBlue" />
          <feBlend in="shiftedRed" in2="shiftedGreen" mode="screen" result="comp1" />
          <feBlend in="shiftedBlue" in2="comp1" mode="screen" result="comp2" />
          <feBlend in="displaced" in2="comp2" mode="lighten" />
        </filter>
      </defs>
    </svg>
  );
}

export function LiquidGlassProvider({
  children,
}: React.PropsWithChildren) {
  const [mode] = React.useState(() => getRuntimeLiquidGlassMode());

  return (
    <LiquidGlassContext.Provider value={mode}>
      {mode === "enhanced" ? <LiquidGlassDefs /> : null}
      {children}
    </LiquidGlassContext.Provider>
  );
}

export function useLiquidGlassMode() {
  return React.useContext(LiquidGlassContext);
}
