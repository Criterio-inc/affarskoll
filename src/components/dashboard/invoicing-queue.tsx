"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { differenceInCalendarDays } from "date-fns";
import {
  grossRevenueForProject,
  isBillableEntry,
  monthKey,
} from "@/lib/revenue";
import type { Project, TimeEntry } from "@/types/project";

interface InvoicingQueueProps {
  projects: Project[];
  timeEntries: TimeEntry[];
}

interface InvoiceRow {
  project: Project;
  billableHours: number;
  estimatedAmount: number;
  daysUntilBilling: number | null;
}

/**
 * Faktureringskö: alla aktiva, debiterbara uppdrag med månadens debiterbara
 * timmar och uppskattat belopp (brutto). Sorterat på belopp så det mest
 * angelägna ligger överst. billingDate är frivillig — finns den visas en
 * dagsbadge, annars timmar. Fakturan skapas sedan i appen (Ekonomi →
 * Fakturor → Ny faktura) — kön är prioriteringslistan.
 */
export function InvoicingQueue({ projects, timeEntries }: InvoicingQueueProps) {
  const now = new Date();
  const monthStr = monthKey(now);

  const rows = useMemo<InvoiceRow[]>(() => {
    const list: InvoiceRow[] = [];

    for (const p of projects) {
      if (p.status !== "aktiv") continue;
      // Bara debiterbara avtalstyper (alla utom rena icke-debiterbara)
      const billableContract =
        p.contractType === "timpris" ||
        p.contractType === "blandat" ||
        p.contractType === "fastpris" ||
        p.contractType === "fastpris_overtid";
      if (!billableContract) continue;

      const monthEntries = timeEntries.filter(
        (e) =>
          e.projectId === p.id &&
          e.date.startsWith(monthStr) &&
          isBillableEntry(e)
      );
      const billableHours = monthEntries.reduce(
        (s, e) => s + Number(e.hours),
        0
      );
      const totalMonthHours = timeEntries
        .filter((e) => e.projectId === p.id && e.date.startsWith(monthStr))
        .reduce((s, e) => s + Number(e.hours), 0);

      const estimatedAmount = grossRevenueForProject(p, {
        total: totalMonthHours,
        billable: billableHours,
      });

      let daysUntilBilling: number | null = null;
      if (p.billingDate) {
        const billingThisMonth = new Date(
          now.getFullYear(),
          now.getMonth(),
          p.billingDate
        );
        daysUntilBilling = differenceInCalendarDays(billingThisMonth, now);
      }

      list.push({ project: p, billableHours, estimatedAmount, daysUntilBilling });
    }

    // Sortera på uppskattat belopp (störst först), sedan timmar
    list.sort(
      (a, b) =>
        b.estimatedAmount - a.estimatedAmount || b.billableHours - a.billableHours
    );

    return list;
  }, [projects, timeEntries, now, monthStr]);

  const totalEstimated = rows.reduce((s, r) => s + r.estimatedAmount, 0);

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Faktureringskö
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Inga aktiva debiterbara uppdrag.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Faktureringskö
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/ekonomi/fakturor/ny">
              <ArrowRight className="h-3 w-3 mr-1" />
              Skapa faktura
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm text-muted-foreground mb-2">
          Uppskattat belopp denna månad:{" "}
          <span className="font-semibold text-foreground">
            {formatCurrency(totalEstimated)}
          </span>
        </div>
        <div className="space-y-1.5">
          {rows.map((r) => {
            const d = r.daysUntilBilling;
            const urgent = d !== null && d <= 3 && d >= 0;
            const passed = d !== null && d < 0;
            return (
              <Link
                key={r.project.id}
                href={`/uppdrag/${r.project.id}`}
                className="block"
              >
                <div className="flex items-center justify-between rounded-md border bg-muted/20 p-2 text-sm hover:bg-muted/40 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.project.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.project.customerName}
                    </p>
                  </div>
                  <div className="text-right ml-2 shrink-0">
                    <p className="text-sm font-semibold">
                      {r.billableHours.toFixed(1)}h
                    </p>
                    {r.estimatedAmount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(r.estimatedAmount)}
                      </p>
                    )}
                  </div>
                  {d !== null && (
                    <Badge
                      variant={passed ? "destructive" : urgent ? "warning" : "outline"}
                      className="ml-2 text-[10px] shrink-0"
                    >
                      {passed
                        ? `${Math.abs(d)}d sen`
                        : d === 0
                        ? "Idag"
                        : `${d}d`}
                    </Badge>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
