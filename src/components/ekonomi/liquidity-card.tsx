"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PiggyBank } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { useProjects } from "@/hooks/use-projects";
import { useTimeEntries } from "@/hooks/use-time-entries";
import { useVatEvents, calculateVatSummary } from "@/hooks/use-vat-events";
import { getSafeSettings } from "@/lib/settings";
import { calculateMonthlyCosts } from "@/lib/calculator-engine";
import {
  netRevenueForProject,
  isBillableEntry,
  monthKey,
} from "@/lib/revenue";
import { getVatOccasions, eventInOccasion, formatDeadlineSv } from "@/lib/vat";
import { formatCurrency } from "@/lib/utils";

// Svensk bolagsskatt 2021– : 20,6 %
const CORPORATE_TAX_RATE = 0.206;

/**
 * "Sätt undan"-vy: kassan ser större ut än den är. Moms, bolagsskatt,
 * arbetsgivaravgift och kommande förmedlingsavgift är inte fria pengar.
 * Visar hur mycket som bör reserveras och vad som är fritt. Uppskattning,
 * inte skatteråd.
 */
export function LiquidityCard() {
  const { data: settingsData } = useSettings();
  const settings = getSafeSettings(settingsData);
  const { data: projects = [] } = useProjects();
  const { data: timeEntries = [] } = useTimeEntries();

  const now = new Date();
  const year = now.getFullYear();
  const { data: vatEvents = [] } = useVatEvents(year);

  const calc = useMemo(() => {
    const cash = Number(settings.cashBuffer) || 0;

    // 1) Moms att betala för innevarande momsperiod (netto ut − in).
    const occasions = getVatOccasions(
      year,
      settings.vatReportingPeriod,
      settings.vatQuarterlyFromYear
    );
    const monthNow = now.getMonth();
    const currentOccasion =
      occasions.find(
        (o) => monthNow >= o.startMonth && monthNow <= o.endMonth
      ) ?? occasions[occasions.length - 1];
    const periodEvents = currentOccasion
      ? vatEvents.filter((e) =>
          eventInOccasion(e.eventDate, currentOccasion, year)
        )
      : [];
    const vatSummary = calculateVatSummary(periodEvents);
    const vatToPay = Math.max(0, vatSummary.netToPay);

    // 2) Preliminär bolagsskatt: 20,6 % av årets resultat hittills (om positivt).
    const currentMonthStr = monthKey(now);
    const hoursPerProject: Record<string, { total: number; billable: number }> =
      {};
    for (const e of timeEntries) {
      if (e.date.slice(0, 4) !== String(year)) continue;
      if (!hoursPerProject[e.projectId])
        hoursPerProject[e.projectId] = { total: 0, billable: 0 };
      const h = Number(e.hours) || 0;
      hoursPerProject[e.projectId].total += h;
      if (isBillableEntry(e)) hoursPerProject[e.projectId].billable += h;
    }
    let ytdNetRevenue = 0;
    for (const p of projects) {
      if (p.status === "arkiverad") continue;
      const ph = hoursPerProject[p.id];
      if (!ph) continue;
      ytdNetRevenue += netRevenueForProject(
        p,
        ph,
        settings.brokerCommissionRate
      );
    }
    const monthsElapsed = now.getMonth() + 1;
    const monthlyCost = calculateMonthlyCosts(settings, true, true).total;
    const ytdResult = ytdNetRevenue - monthlyCost * monthsElapsed;
    const corporateTax = Math.max(0, ytdResult) * CORPORATE_TAX_RATE;

    // 3) Arbetsgivaravgift — en månad (betalas 12:e nästa månad).
    const employerTax = settings.monthlySalaryGross * settings.employerTaxRate;

    // 4) Kommande förmedlingsavgift.
    const brokerFee = settings.brokerMonthlyFee;

    const reserved = vatToPay + corporateTax + employerTax + brokerFee;
    const free = cash - reserved;

    return {
      cash,
      vatToPay,
      vatDeadline: currentOccasion?.deadline ?? null,
      corporateTax,
      employerTax,
      brokerFee,
      reserved,
      free,
    };
  }, [settings, projects, timeEntries, vatEvents, year, now]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-muted-foreground" />
          Sätt undan
        </CardTitle>
        <CardDescription>
          Så mycket av kassan är inte dina pengar (uppskattning)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Kassa (ingående)</span>
          <span className="font-medium">{formatCurrency(calc.cash)}</span>
        </div>

        <div className="space-y-1.5 border-t pt-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Moms att betala
              {calc.vatDeadline && (
                <span className="text-xs">
                  {" "}
                  (senast {formatDeadlineSv(calc.vatDeadline)})
                </span>
              )}
            </span>
            <span>−{formatCurrency(calc.vatToPay)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bolagsskatt (prel. 20,6%)</span>
            <span>−{formatCurrency(Math.round(calc.corporateTax))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Arbetsgivaravgift (1 mån)</span>
            <span>−{formatCurrency(Math.round(calc.employerTax))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Förmedlingsavgift (nästa mån)</span>
            <span>−{formatCurrency(calc.brokerFee)}</span>
          </div>
          <div className="flex justify-between font-medium border-t pt-1.5">
            <span>Reserverat</span>
            <span>{formatCurrency(Math.round(calc.reserved))}</span>
          </div>
        </div>

        <div
          className={`flex justify-between rounded-md p-3 ${
            calc.free >= 0
              ? "bg-green-500/5 border border-green-500/20"
              : "bg-amber-500/5 border border-amber-500/20"
          }`}
        >
          <span className="font-semibold">Fritt att använda</span>
          <span
            className={`font-bold ${
              calc.free >= 0 ? "text-green-600" : "text-amber-600"
            }`}
          >
            {formatCurrency(Math.round(calc.free))}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Uppdatera kassan under Inställningar. Bolagsskatten baseras på årets
          resultat hittills — en uppskattning, inte skatteråd.
        </p>
      </CardContent>
    </Card>
  );
}
