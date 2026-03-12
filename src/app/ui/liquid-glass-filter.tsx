export function LiquidGlassFilter() {
  return (
    <svg
      width={0}
      height={0}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      version="2"
      style={{ display: "none" }}
    >
      <defs>
        <filter id="liquidGlassFilter" filterUnits="userSpaceOnUse">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.005"
            numOctaves="2"
            result="fractal"
            stitchTiles="stitch"
          />
          <feDisplacementMap
            in2="fractal"
            in="SourceGraphic"
            scale="25"
            result="turbDisplaced"
          />

          <feColorMatrix
            in="SourceGraphic"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="red"
          />
          <feOffset dx="3" dy="0" in="red" result="shiftedRed" />

          <feColorMatrix
            in="SourceGraphic"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="green"
          />
          <feOffset dx="0" dy="2" in="green" result="shiftedGreen" />

          <feColorMatrix
            in="SourceGraphic"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
            result="blue"
          />
          <feOffset dx="-3" dy="0" in="blue" result="shiftedBlue" />

          <feBlend in="shiftedRed" in2="shiftedGreen" result="comp1" mode="screen" />
          <feBlend in="shiftedBlue" in2="comp1" result="comp2" mode="screen" />
          <feBlend in="SourceGraphic" in2="comp2" result="out" mode="lighten" />
        </filter>
      </defs>
    </svg>
  );
}
