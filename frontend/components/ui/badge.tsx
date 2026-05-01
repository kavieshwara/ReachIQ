import { cn } from "@/lib/utils";

const variants = {
  default: "bg-primary/12 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-danger/12 text-danger",
  muted: "bg-surface2 text-textSecondary"
};

export function Badge({
  children,
  variant = "default",
  className
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", variants[variant], className)}>{children}</span>;
}
