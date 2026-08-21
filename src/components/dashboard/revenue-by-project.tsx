"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Layers } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  netRevenueForProject,
  isBillableEntry,
  monthKey,
} from "@/lib/revenue";
import type { Project, TimeEntry } from "@/types/project";

interface RevenueByProjectProps {
  projects: Project[];
  timeEntries: TimeEntry[];
  commissionRate: number;
}

interface Row {
  project: Project;
  monthBillableHours: number;
  monthNet: number;
  totalBillableHours: number;
  budgetedHours: number;
}

/**
 * Visar var månadens intäkt kommer ifrån (uppdelning av Intäkt-KPI:n) och
 * varje bidragande uppdrags ackumulerade timmar mot budget. Flaggar tid som
 * loggats på uppdrag som inte är aktiva.
 */
export function RevenueByProject({
  projects,
  timeEntries,
  commissionRate,
}: RevenueByProjectProps) {
  const now = new Date();
  const monthStr = monthKey(now);

  const rows = useMemo<Row[]>(() => {
    // Aggregera timmar per projekt: månad (total/billable) + ackumulerat billable
    const month: Record<string, { total: number; billable: number }> = {};
    const totalBillable: Record<string, number> = {};

    for (const e of timeEntries) {
      const billable = isBillableEntry(e) ? Number(e.hours) || 0 : 0;
      totalBillable[e.projectId] = (totalBillable[e.projectId] ?? 0) + billable;

      if (e.date.startsWith(monthStr)) {
        if (!month[e.projectId]) month[e.projectId] = { total: 0, billable: 0 };
        month[e.projectId].total += Number(e.hours) || 0;
        month[e.projectId].billable += billable;
      }
    }

    const list: Row[] = [];
    for (const project of projects) {
      if (project.status === "arkiverad") continue;
      const mh = month[project.id];
      if (!mh || mh.total === 0) continue;

      const monthNet = netRevenueForProject(project, mh, commissionRate);

      list.push({
        project,
        monthBillableHours: mh.billable,
        monthNet,
        totalBillableHours: totalBillable[project.id] ?? 0,
        budgetedHours: Number(project.budgetedHours) || 0,
      });
    }

    list.sort((a, b) => b.monthNet - a.monthNet);
    return list;
  }, [projects, timeEntries, commissionRate, monthStr]);

  const totalNet = rows.reduce((s, r) => s + r.monthNet, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          Intäkt per uppdrag (denna månad)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ingen registrerad tid denna månad.
          </p>
        ) : (
          <>
            <div className="text-sm text-muted-foreground">
              Summa netto:{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(totalNet)}
              </span>
            </div>
            <div className="space-y-2.5">
              {rows.map((r) => {
                const pct =
                  r.budgetedHours > 0
                    ? Math.min(
                        (r.totalBillableHours / r.budgetedHours) * 100,
                        100
                      )
                    : 0;
                const over =
                  r.budgetedHours > 0 &&
                  r.totalBillableHours > r.budgetedHours;
                const notActive = r.project.status !== "aktiv";
                return (
                  <Link
                    key={r.project.id}
                    href={`/uppdrag/${r.project.id}`}
                    className="block rounded-md border bg-muted/20 p-2.5 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm truncate">
                            {r.project.title}
                          </p>
                          {notActive && (
                            <Badge
                              variant="outline"
                              className="text-[10px] shrink-0"
                            >
                              {r.project.status === "avslutad"
                                ? "Avslutad"
                                : r.project.status}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {r.project.customerName}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">
                          {formatCurrency(r.monthNet)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.monthBillableHours.toFixed(1)}h debiterbart
                        </p>
                      </div>
                    </div>
                    {r.budgetedHours > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>Ackumulerat mot budget</span>
                          <span className={over ? "text-destructive font-medium" : ""}>
                            {r.totalBillableHours.toFixed(0)} / {r.budgetedHours}h
                          </span>
                        </div>
                        <Progress
                          value={pct}
                          className={`h-1.5 ${over ? "[&>div]:bg-destructive" : ""}`}
                        />
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
