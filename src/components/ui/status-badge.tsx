"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const statusVariants = {
  success: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  destructive: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  default: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800",
} as const;

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: keyof typeof statusVariants;
  children: React.ReactNode;
}

export function StatusBadge({ status = "default", className, children, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        statusVariants[status],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
