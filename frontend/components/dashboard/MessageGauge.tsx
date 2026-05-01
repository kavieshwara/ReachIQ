"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

export function MessageGauge({ used, total }: { used: number; total: number }) {
  const percent = Math.min(100, Math.round((used / Math.max(1, total)) * 100));
  const color = percent < 60 ? "stroke-success" : percent < 85 ? "stroke-warning" : "stroke-danger";

  return (
    <Card>
      <CardContent className="flex items-center gap-6">
        <div className="relative h-28 w-28">
          <svg className="h-28 w-28 -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="46" className="fill-none stroke-surface2 stroke-[10]" />
            <motion.circle
              cx="60"
              cy="60"
              r="46"
              className={`fill-none ${color} stroke-[10]`}
              strokeLinecap="round"
              strokeDasharray={289}
              initial={{ strokeDashoffset: 289 }}
              animate={{ strokeDashoffset: 289 - (289 * percent) / 100 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-textPrimary">{percent}%</span>
            <span className="text-xs text-textSecondary">used</span>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-lg font-semibold text-textPrimary">Daily message usage</p>
          <p className="text-sm text-textSecondary">
            {used} / {total} messages sent today
          </p>
          <p className="text-sm text-primary">Invite a friend to get +10 extra messages per day.</p>
        </div>
      </CardContent>
    </Card>
  );
}
