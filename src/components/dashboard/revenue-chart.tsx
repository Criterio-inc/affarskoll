"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { netRevenueForProject, isBillableEntry } from "@/lib/revenue";
import type { Project, TimeEntry } from "@/types/project";

interface RevenueChartProps {
  projects: Project[];
  timeEntries: TimeEntry[];
  commissionRate: number;
}

export function RevenueChart({
  projects,
  timeEntries,
  commissionRate,
}: RevenueChartProps) {
  const chartData = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string }[] = [];

    // Last 6 months including current
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("sv-SE", { month: "short" });
      months.push({ key, label });
    }

    // Build project lookup
    const projectMap = new Map(projects.map((p) => [p.id, p]));

    return months.map(({ key, label }) => {
      const monthEntries = timeEntries.filter((e) => e.date.startsWith(key));

      // Aggregera timmar per projekt (total + debiterbart) och använd sedan
      // den delade intäktsmodellen — samma som Översiktens KPI:er.
      const hoursPerProject: Record<
        string,
        { total: number; billable: number }
      > = {};
      let totalHours = 0;
      for (const entry of monthEntries) {
        const h = Number(entry.hours) || 0;
        totalHours += h;
        if (!hoursPerProject[entry.projectId]) {
          hoursPerProject[entry.projectId] = { total: 0, billable: 0 };
        }
        hoursPerProject[entry.projectId].total += h;
        if (isBillableEntry(entry)) {
          hoursPerProject[entry.projectId].billable += h;
        }
      }

      let netRevenue = 0;
      for (const [projectId, hours] of Object.entries(hoursPerProject)) {
        const project = projectMap.get(projectId);
        if (!project || project.status === "arkiverad") continue;
        netRevenue += netRevenueForProject(project, hours, commissionRate);
      }

      return {
        month: label,
        intakt: Math.round(netRevenue),
        timmar: Math.round(totalHours * 10) / 10,
      };
    });
  }, [projects, timeEntries, commissionRate]);

  const hasData = chartData.some((d) => d.intakt > 0 || d.timmar > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Intäktsutveckling
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-48 rounded-md bg-muted/50 flex items-center justify-center text-xs text-muted-foreground">
            Registrera tid för att se intäktstrend
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={192}>
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border"
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis
                tickFormatter={(v) =>
                  v >= 1000 ? `${Math.round(v / 1000)}k` : v
                }
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: "0.75rem",
                }}
                formatter={(value: number) => [formatCurrency(value), "Netto"]}
                labelFormatter={(label) => `Månad: ${label}`}
              />
              <Area
                type="monotone"
                dataKey="intakt"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
