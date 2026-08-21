"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  /** Kortare värde som visas på små skärmar (t.ex. "176k kr"). */
  valueCompact?: string;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "default" | "primary" | "accent";
}

export function StatCard({ title, value, valueCompact, subtitle, icon: Icon, variant = "default" }: StatCardProps) {
  return (
    <div className={cn(
      "rounded-lg border p-3 sm:p-4 space-y-1",
      variant === "primary" && "bg-primary/5 border-primary/20",
      variant === "accent" && "bg-success/5 border-success/20",
    )}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4 shrink-0" />
        <span className="text-xs font-medium truncate">{title}</span>
      </div>
      <p className="text-base sm:text-xl font-bold leading-tight tabular-nums">
        {valueCompact ? (
          <>
            <span className="sm:hidden">{valueCompact}</span>
            <span className="hidden sm:inline">{value}</span>
          </>
        ) : (
          value
        )}
      </p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
