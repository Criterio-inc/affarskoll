"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSyncedPortfolio } from "@/hooks/use-portfolio";
import { useSettings } from "@/hooks/use-settings";
import { getSafeSettings } from "@/lib/settings";
import {
  calculateMonthlyForecast,
  calculateBreakEvenThreshold,
} from "@/lib/calculator-engine";
import { formatCurrency } from "@/lib/utils";

export function PortfolioForecastWidget() {
  // Synkad portfölj (aktiva projekt + manuella poster) — samma källa som
  // Runway-kortet, så de två widgetsen inte motsäger varandra.
  const { merged: assignments } = useSyncedPortfolio();
  const { data: settingsData } = useSettings();

  const settings = useMemo(
    () => getSafeSettings(settingsData ?? null),
    [settingsData]
  );

  const forecastData = useMemo(() => {
    if (assignments.length === 0) return [];

    const forecast = calculateMonthlyForecast({ assignments, settings });

    // Show next 6 months from now
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const fromIndex = forecast.findIndex((m) => m.month >= currentMonth);
    if (fromIndex === -1) return forecast.slice(-6);

    return forecast.slice(fromIndex, fromIndex + 6);
  }, [assignments, settings]);

  const breakEven = useMemo(
    () => calculateBreakEvenThreshold(settings),
    [settings]
  );

  const hasData = assignments.length > 0 && forecastData.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Portföljprognos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Markera uppdrag som aktiva för att se en 6-månaders prognos.
            </p>
            <div className="h-32 rounded-md bg-muted/50 flex items-center justify-center text-xs text-muted-foreground">
              Inga aktiva uppdrag
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart
                data={forecastData}
                margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
              >
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tickFormatter={(v) =>
                    v >= 1000 ? `${Math.round(v / 1000)}k` : v
                  }
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "0.75rem",
                  }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "revenue" ? "Intäkt" : "Kostnad",
                  ]}
                />
                <ReferenceLine
                  y={breakEven}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="3 3"
                  label={{
                    value: "Break-even",
                    position: "insideTopRight",
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                  }}
                />
                <Bar
                  dataKey="revenue"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  name="revenue"
                />
                <Bar
                  dataKey="costs"
                  fill="hsl(var(--muted-foreground))"
                  opacity={0.3}
                  radius={[4, 4, 0, 0]}
                  name="costs"
                />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[hsl(160,84%,39%)]" />
                Intäkt
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-muted-foreground/30" />
                Kostnad
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
