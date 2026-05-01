"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "full" | "icon";
  theme?: "light" | "dark" | "color";
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
  animated?: boolean;
}

const sizes = {
  sm: { height: 28, iconSize: 28, fontSize: 17 },
  md: { height: 36, iconSize: 36, fontSize: 22 },
  lg: { height: 48, iconSize: 48, fontSize: 30 }
} as const;

const brandIconSrc = "/logo/brand-icon.png?v=20260430";

export function LogoIcon({
  size = "md",
  className = ""
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const px = sizes[size].iconSize;

  return (
    <span
      className={cn("logo-wrapper inline-flex shrink-0 overflow-hidden rounded-[18px]", className)}
      style={{ width: px, height: px }}
    >
      <Image
        src={brandIconSrc}
        alt="ReachIQ icon"
        width={px}
        height={px}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

export function Logo({
  variant = "full",
  theme = "light",
  size = "md",
  href = "/",
  className = "",
  animated = false
}: LogoProps) {
  const { height, fontSize } = sizes[size];
  const wordmarkColor = {
    light: { reach: "#1A1A2E", iq: "#00D9A6" },
    dark: { reach: "#FFFFFF", iq: "#00D9A6" },
    color: { reach: "#FFFFFF", iq: "#00D9A6" }
  }[theme];

  const content = (
    <div className={cn("inline-flex items-center gap-3 select-none", className)} style={{ minHeight: height }}>
      <LogoIcon size={size} className={animated ? "logo-animated" : ""} />
      {variant === "full" ? (
        <span
          className="leading-none"
          style={{
            fontSize,
            fontWeight: 600,
            letterSpacing: "-0.04em",
            fontFamily: "Inter, system-ui, sans-serif"
          }}
        >
          <span style={{ color: wordmarkColor.reach }}>reach</span>
          <span style={{ color: wordmarkColor.iq }}>iq</span>
        </span>
      ) : null}
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="inline-flex items-center no-underline">
      {content}
    </Link>
  );
}

export default Logo;
