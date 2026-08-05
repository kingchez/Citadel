"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-text-on hover:bg-accent-hover shadow-sm",
  secondary:
    "bg-surface text-text border border-border hover:border-border-strong",
  danger:
    "bg-danger-soft text-danger hover:bg-danger hover:text-white",
  ghost: "text-text-muted hover:bg-bg hover:text-text",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = "secondary", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium",
          "transition-[transform,background-color,color,border-color,box-shadow] duration-150",
          "disabled:pointer-events-none disabled:opacity-50",
          "active:scale-[0.97]",
          VARIANT_CLASSES[variant],
          className
        )}
        style={{ transitionTimingFunction: "var(--ease-out)" }}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
