"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { calculateMonthlyForecast, getSafeSettings } from "@/lib/calculator-engine";
import { AppSettings } from "@/lib/settings";
import { PortfolioAssignment } from "@/types/portfolio";

interface RunwayCardProps {
  assignments: PortfolioAssignment[];
  settings: AppSettings;
  /** Current cash buffer in SEK (optional; defaults to 0) */
  cashBuffer?: number;
}

/**
 * Forslag 1: Runway-kort
 * Visar hur manga manader kassan racker med aktuell prognos och brenn-hastighet.
 */
export function RunwayCard({
  assignments,
  settings,
  cashBuffer = 0,
}: RunwayCardProps) {
  const safeSettings = getSafeSettings(settings);

  const runway = useMemo(() => {
    const fullForecast = calculateMonthlyForecast({
      assignments,
      settings: safeSettings,
    });

    // Titta bara FRAMÅT från innevarande månad. Kassan är pengar idag.
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;
    const forecast = fullForecast.filter((m) => m.month >= currentMonthKey);

    if (forecast.length === 0) {
      return {
        committedMonths: 0,
        cashRunsOutAt: null,
        committedNet: 0,
        status: "neutral" as const,
      };
    }

    // Bokad beläggning framåt: månader med faktiskt schemalagda timmar på ett
    // uppdrag. Detta är det ärliga "runway"-måttet — inte prognoshorisonten.
    // (Prognosen sträcker sig flera år, men nollar lönen i tomma månader, så
    // ett rått "månader tills negativ" blev missvisande höga 37.)
    const committedForecast = forecast.filter((m) => (m.workedHours ?? 0) > 0);
    const committedMonths = committedForecast.length;

    // Netto under den bokade perioden (samma horisont som beläggningen visar).
    const committedNet = committedForecast.reduce((s, m) => s + m.net, 0);

    // Varna om kassan (ingående + bokat netto månad för månad) blir negativ
    // inom den bokade perioden.
    let balance = cashBuffer;
    let runOutAt: string | null = null;
    for (const m of committedForecast) {
      balance += m.net;
      if (balance < 0 && runOutAt === null) {
        runOutAt = m.monthLabel;
      }
    }

    const status = runOutAt
      ? ("warning" as const)
      : committedMonths >= 6
      ? ("healthy" as const)
      : committedMonths >= 3
      ? ("ok" as const)
      : ("warning" as const);

    return { committedMonths, cashRunsOutAt: runOutAt, committedNet, status };
  }, [assignments, safeSettings, cashBuffer]);

  const statusColor =
    runway.status === "healthy"
      ? "text-green-600"
      : runway.status === "ok"
      ? "text-blue-600"
      : "text-amber-600";

  const statusBg =
    runway.status === "healthy"
      ? "bg-green-500/5"
      : runway.status === "ok"
      ? "bg-blue-500/5"
      : "bg-amber-500/5";

  return (
    <Card className={statusBg}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          Runway
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Koppla uppdrag för att se bokad beläggning och kassaflöde.
          </p>
        ) : (
          <>
            <div>
              <p className={`text-3xl font-bold ${statusColor}`}>
                {runway.committedMonths}
                <span className="text-base font-normal text-muted-foreground ml-1">
                  mån
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bokad beläggning framåt
              </p>
            </div>

            {runway.cashRunsOutAt && (
              <div className="flex items-start gap-2 text-xs rounded-md border bg-amber-500/10 p-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                <span>
                  Kassan blir negativ i <strong>{runway.cashRunsOutAt}</strong>
                </span>
              </div>
            )}

            <div className="pt-2 border-t text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ingående kassa</span>
                <span>{formatCurrency(cashBuffer)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">
                  Netto, bokad period
                </span>
                <span className={runway.committedNet >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatCurrency(runway.committedNet)}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
