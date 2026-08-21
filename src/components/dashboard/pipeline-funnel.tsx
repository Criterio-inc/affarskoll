"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { subMonths, format, startOfMonth } from "date-fns";
import { sv } from "date-fns/locale";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { Project } from "@/types/project";

interface PipelineFunnelProps {
  projects: Project[];
  months?: number;
}

/**
 * Forslag 10: Pipeline-conversion-graf.
 * Stackar projekt per createdAt-manad efter nuvarande status, samt visar
 * hur manga som har lyckats (aktiv/avslutad) vs inte (prospekt/arkiverad).
 */
export function PipelineFunnel({
  projects,
  months = 12,
}: PipelineFunnelProps) {
  // Färre månader på mobil så x-axeln inte trängs ihop.
  const isMobile = useMediaQuery("(max-width: 639px)");
  const effectiveMonths = isMobile ? Math.min(months, 6) : months;

  const data = useMemo(() => {
    const now = new Date();
    const buckets: Array<{
      month: string;
      monthLabel: string;
      prospekt: number;
      aktiv: number;
      avslutad: number;
      arkiverad: number;
      total: number;
      conversion: number;
    }> = [];

    for (let i = effectiveMonths - 1; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthKey = format(monthDate, "yyyy-MM");
      const monthLabel = format(monthDate, "MMM yy", { locale: sv });
      buckets.push({
        month: monthKey,
        monthLabel,
        prospekt: 0,
        aktiv: 0,
        avslutad: 0,
        arkiverad: 0,
        total: 0,
        conversion: 0,
      });
    }

    const bucketMap = new Map(buckets.map((b) => [b.month, b]));

    for (const p of projects) {
      const createdAt = p.createdAt
        ? new Date(p.createdAt)
        : new Date(p.startDate);
      const key = format(startOfMonth(createdAt), "yyyy-MM");
      const bucket = bucketMap.get(key);
      if (!bucket) continue;

      const status = p.status as
        | "prospekt"
        | "aktiv"
        | "avslutad"
        | "arkiverad";
      bucket[status] = (bucket[status] ?? 0) + 1;
      bucket.total += 1;
    }

    // Compute conversion rate (aktiv + avslutad) / total
    for (const b of buckets) {
      const converted = b.aktiv + b.avslutad;
      b.conversion = b.total > 0 ? Math.round((converted / b.total) * 100) : 0;
    }

    return buckets;
  }, [projects, effectiveMonths]);

  const totals = useMemo(() => {
    const t = { prospekt: 0, aktiv: 0, avslutad: 0, arkiverad: 0, total: 0 };
    for (const b of data) {
      t.prospekt += b.prospekt;
      t.aktiv += b.aktiv;
      t.avslutad += b.avslutad;
      t.arkiverad += b.arkiverad;
      t.total += b.total;
    }
    return t;
  }, [data]);

  const overallConversion =
    totals.total > 0
      ? Math.round(((totals.aktiv + totals.avslutad) / totals.total) * 100)
      : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Pipeline-konvertering (senaste {effectiveMonths} mån)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-xs">
          <div className="rounded-md border bg-yellow-500/5 p-2">
            <p className="text-muted-foreground">Prospekt</p>
            <p className="text-lg font-semibold">{totals.prospekt}</p>
          </div>
          <div className="rounded-md border bg-green-500/5 p-2">
            <p className="text-muted-foreground">Aktiva</p>
            <p className="text-lg font-semibold">{totals.aktiv}</p>
          </div>
          <div className="rounded-md border bg-blue-500/5 p-2">
            <p className="text-muted-foreground">Avslutade</p>
            <p className="text-lg font-semibold">{totals.avslutad}</p>
          </div>
          <div className="rounded-md border bg-muted/30 p-2">
            <p className="text-muted-foreground">Konvertering</p>
            <p className="text-lg font-semibold">{overallConversion}%</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="monthLabel" fontSize={11} />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  prospekt: "Prospekt",
                  aktiv: "Aktiv",
                  avslutad: "Avslutad",
                  arkiverad: "Arkiverad",
                };
                return [value, labels[name] || name];
              }}
              labelFormatter={(label) => `Skapade i ${label}`}
            />
            <Legend
              formatter={(value: string) => {
                const labels: Record<string, string> = {
                  prospekt: "Prospekt",
                  aktiv: "Aktiv",
                  avslutad: "Avslutad",
                  arkiverad: "Arkiverad",
                };
                return labels[value] || value;
              }}
            />
            <Bar dataKey="prospekt" stackId="s" fill="hsl(var(--warning))" name="prospekt" />
            <Bar dataKey="aktiv" stackId="s" fill="hsl(var(--success))" name="aktiv" />
            <Bar dataKey="avslutad" stackId="s" fill="hsl(var(--info))" name="avslutad" />
            <Bar dataKey="arkiverad" stackId="s" fill="hsl(var(--muted-foreground))" name="arkiverad" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
