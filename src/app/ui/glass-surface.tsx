import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

import { useLiquidGlassMode } from "./liquid-glass-provider";

const glassSurfaceVariants = cva(
  "group/glass relative isolate overflow-hidden border border-transparent bg-transparent",
  {
    variants: {
      variant: {
        panel: "rounded-[1.25rem]",
        toolbar: "rounded-[1.25rem]",
        sidebar: "rounded-[1.25rem]",
        warning: "rounded-[1.25rem]",
        danger: "rounded-[1.25rem]",
      },
      interactive: {
        true: "motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none",
        false: "",
      },
    },
    defaultVariants: {
      interactive: false,
    },
  },
);

interface GlassSurfaceProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  refraction: "none" | "soft";
  variant: "panel" | "toolbar" | "sidebar" | "warning" | "danger";
}

export function GlassSurface({
  children,
  className,
  interactive = false,
  refraction,
  variant,
}: GlassSurfaceProps) {
  const mode = useLiquidGlassMode();
  const refractionActive =
    mode === "enhanced" &&
    refraction === "soft" &&
    interactive &&
    variant === "panel";
  const fxStyle = {
    "--glass-refraction-filter": refractionActive
      ? "url(#liquidGlassFilterSoft)"
      : "none",
  } as React.CSSProperties;

  return (
    <div
      className={cn(glassSurfaceVariants({ interactive, variant }), className)}
      data-glass-surface=""
      data-interactive={interactive ? "true" : "false"}
      data-mode={mode}
      data-refraction={refraction}
      data-refraction-active={refractionActive ? "true" : "false"}
      data-variant={variant}
    >
      <div
        aria-hidden="true"
        className="glass-surface__fx absolute inset-0 rounded-[inherit] pointer-events-none"
        style={fxStyle}
      />
      <div className="glass-surface__content relative z-10 h-full">
        {children}
      </div>
    </div>
  );
}
