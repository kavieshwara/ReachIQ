"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "default" | "lg";
};

export function Button({ className, variant = "primary", size = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-2xl text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" && "px-3 py-2 text-xs",
        size === "default" && "px-4 py-2.5",
        size === "lg" && "px-5 py-3 text-base",
        variant === "primary" && "bg-cta-gradient text-white shadow-[0_18px_40px_rgba(108,99,255,0.32)] hover:-translate-y-0.5 hover:scale-[1.01]",
        variant === "secondary" && "glass-panel border border-white/8 text-textPrimary hover:border-primary/30 hover:bg-white/[0.08]",
        variant === "ghost" && "bg-transparent text-textSecondary hover:bg-white/[0.05] hover:text-textPrimary",
        variant === "danger" && "border border-danger/20 bg-danger/12 text-danger hover:bg-danger/20",
        className
      )}
      {...props}
    />
  );
}
