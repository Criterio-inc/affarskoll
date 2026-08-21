"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { AppSettings, getEffectiveBillableHoursPerYear } from "@/lib/settings";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  parseISO,
} from "date-fns";
import type { TimeEntry } from "@/types/project";

interface UtilizationCardProps {
  timeEntries: TimeEntry[];
  settings: AppSettings;
}

/**
 * Forslag 2: Belaggningsgrad-kort.
 * Visar debiterbara timmar / mal for vecka, manad och ar.
 */
export function UtilizationCard({
  timeEntries,
  settings,
}: UtilizationCardProps) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);

  const stats = useMemo(() => {
    let weekBillable = 0;
    let monthBillable = 0;
    let yearBillable = 0;

    for (const entry of timeEntries) {
      if (entry.isBillable === false || entry.category === "ej_debiterbar") continue;
      const date = parseISO(entry.date);
      const hours = Number(entry.hours) || 0;

      if (date >= weekStart && date <= weekEnd) weekBillable += hours;
      if (date >= monthStart && date <= monthEnd) monthBillable += hours;
      if (date >= yearStart && date <= yearEnd) yearBillable += hours;
    }

    const weeklyTarget = settings.targetWeeklyHours;
    const yearlyTarget = getEffectiveBillableHoursPerYear(settings);
    const monthlyTarget = yearlyTarget / 12;

    return {
      week: { used: weekBillable, target: weeklyTarget },
      month: { used: monthBillable, target: monthlyTarget },
      year: { used: yearBillable, target: yearlyTarget },
    };
  }, [timeEntries, settings, weekStart, weekEnd, monthStart, monthEnd, yearStart, yearEnd]);

  const renderBar = (label: string, used: number, target: number) => {
    const pct = target > 0 ? Math.min((used / target) * 100, 100) : 0;
    const over = used > target;
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className={`font-medium ${over ? "text-success" : ""}`}>
            {used.toFixed(1)} / {target.toFixed(0)}h
            <span className="text-muted-foreground ml-1">
              ({Math.round(pct)}%)
            </span>
          </span>
        </div>
        <Progress
          value={pct}
          className={`h-1.5 ${
            pct >= 100
              ? "[&>div]:bg-success"
              : pct >= 80
              ? "[&>div]:bg-primary"
              : ""
          }`}
        />
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Target className="w-4 h-4 text-muted-foreground" />
          Beläggningsgrad (debiterbart)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {renderBar("Denna vecka", stats.week.used, stats.week.target)}
        {renderBar("Denna månad", stats.month.used, stats.month.target)}
        {renderBar("I år", stats.year.used, stats.year.target)}
      </CardContent>
    </Card>
  );
}
