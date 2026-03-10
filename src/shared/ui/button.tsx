import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "@/shared/lib/utils";

type ButtonVariant = "solid" | "ghost";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClassMap: Record<ButtonVariant, string> = {
  solid:
    "bg-[hsl(var(--accent-strong))] text-[hsl(var(--accent-fg))] border-transparent hover:opacity-95",
  ghost:
    "bg-transparent text-[hsl(var(--fg))] border-[hsl(var(--line))] hover:border-[hsl(var(--line-strong))] hover:bg-[hsl(var(--panel)/0.84)]",
};

const sizeClassMap: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "solid", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl border font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60",
          variantClassMap[variant],
          sizeClassMap[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
