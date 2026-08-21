"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AppSettings } from "@/lib/settings";
import { getSafeSettings } from "@/lib/calculator-engine";
import {
  calculateOptimalSalaryDividendMix,
  calculateRequiredHourlyRate,
  calculateCompanyCosts,
  calculateFullTaxBreakdown,
} from "@/lib/swedish-tax";
import { formatCurrency } from "@/lib/utils";
import {
  PiggyBank,
  Banknote,
  TrendingUp,
  Percent,
  Calculator,
} from "lucide-react";

interface DividendPlannerProps {
  settings: AppSettings;
}

export function DividendPlanner({ settings }: DividendPlannerProps) {
  const safeSettings = getSafeSettings(settings);
  const [companyProfit, setCompanyProfit] = useState(1200000);

  const optimalMix = useMemo(() => {
    const annualSalary = safeSettings.monthlySalaryGross * 12;
    return calculateOptimalSalaryDividendMix(
      companyProfit,
      annualSalary,
      safeSettings.employerTaxRate,
      safeSettings.municipalTaxRate,
      safeSettings.dividendLimit,
      safeSettings.stateTaxThreshold,
      safeSettings.stateTaxRate
    );
  }, [companyProfit, safeSettings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <PiggyBank className="w-5 h-5" />
          Lön vs utdelning
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Bolagets årsvinst (SEK)</Label>
          <Input
            type="number"
            value={companyProfit}
            onChange={(e) => setCompanyProfit(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Total intäkt minus externa kostnader
          </p>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg border">
            <Banknote className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Optimal lön</p>
              <p className="text-xl font-bold text-blue-600">
                {formatCurrency(optimalMix.salary)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(Math.round(optimalMix.salary / 12))}/mån
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border">
            <TrendingUp className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Optimal utdelning</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(optimalMix.dividend)}
              </p>
              <p className="text-xs text-muted-foreground">
                Inom 3:12 gränsbelopp ({formatCurrency(safeSettings.dividendLimit)})
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-accent/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Total nettoinkomst</p>
              <p className="text-lg font-bold">
                {formatCurrency(optimalMix.totalNetIncome)}
              </p>
            </div>
            <div className="text-center p-3 bg-accent/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Total skatt</p>
              <p className="text-lg font-bold text-red-600">
                {formatCurrency(optimalMix.totalTaxPaid)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 p-3 rounded-lg border">
            <Percent className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Skatteeffektivitet:</span>
            <span className="text-lg font-bold">
              {optimalMix.taxEfficiency.toFixed(1)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface PricingCalculatorProps {
  settings: AppSettings;
}

export function PricingCalculator({ settings }: PricingCalculatorProps) {
  const safeSettings = getSafeSettings(settings);

  const pricing = useMemo(() => {
    const companyCosts = calculateCompanyCosts(
      safeSettings.monthlySalaryGross,
      safeSettings.employerTaxRate,
      safeSettings.fixedMonthlyCosts,
      safeSettings.brokerMonthlyFee
    );

    const annualCosts = companyCosts.totalAnnualCost;
    const billableHours = safeSettings.targetBillableHoursPerYear;

    const rates = calculateRequiredHourlyRate(
      annualCosts,
      billableHours,
      safeSettings.brokerCommissionRate,
      safeSettings.safetyMargin
    );

    const taxBreakdown = calculateFullTaxBreakdown(
      safeSettings.monthlySalaryGross,
      safeSettings.employerTaxRate,
      safeSettings.municipalTaxRate
    );

    return { rates, companyCosts, taxBreakdown, annualCosts, billableHours };
  }, [safeSettings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Rekommenderat timpris
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Årlig kostnad</span>
            <span className="font-medium">
              {formatCurrency(pricing.annualCosts)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">
              Debiterbara timmar/år
            </span>
            <span className="font-medium">{pricing.billableHours}h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">
              Säkerhetsmarginal
            </span>
            <span className="font-medium">
              {Math.round(safeSettings.safetyMargin * 100)}%
            </span>
          </div>

          <Separator />

          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">
              Minimum timpris (break-even)
            </span>
            <span className="font-medium text-red-600">
              {formatCurrency(pricing.rates.minimumHourlyRate)}/h
            </span>
          </div>
          <div className="flex justify-between text-lg">
            <span className="font-medium">Rekommenderat timpris</span>
            <span className="font-bold text-green-600">
              {formatCurrency(pricing.rates.recommendedHourlyRate)}/h
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">
              Effektivt (efter provision)
            </span>
            <span className="font-medium">
              {formatCurrency(pricing.rates.effectiveHourlyRate)}/h
            </span>
          </div>

          <Separator />

          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Nettolön</span>
            <span className="font-medium">
              {formatCurrency(pricing.taxBreakdown.netSalary)}/mån
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
