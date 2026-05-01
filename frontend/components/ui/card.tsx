import { cn } from "@/lib/utils";

export function Card({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("glass-panel rounded-[28px] border border-white/8 bg-surface/80 shadow-[0_24px_80px_rgba(0,0,0,0.32)]", className)}>{children}</div>;
}

export function CardContent({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("p-6", className)}>{children}</div>;
}
