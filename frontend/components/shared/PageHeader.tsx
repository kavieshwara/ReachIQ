import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-5 rounded-[28px] border border-white/8 bg-white/[0.03] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="space-y-3">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/80">{eyebrow}</p> : null}
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight text-textPrimary lg:text-4xl">{title}</h2>
          {description ? <p className="max-w-2xl text-sm leading-6 text-textSecondary">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
