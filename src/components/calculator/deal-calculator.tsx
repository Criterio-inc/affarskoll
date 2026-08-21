"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ContractType, CONTRACT_TYPE_LABELS } from "@/types/project";
import { PortfolioAssignment } from "@/types/portfolio";
import { AppSettings } from "@/lib/settings";
import { getSafeSettings, calculateEffectiveHours } from "@/lib/calculator-engine";
import { formatCurrency } from "@/lib/utils";
import { Calculator, Plus, TrendingUp, TrendingDown } from "lucide-react";

interface DealCalculatorProps {
  settings: AppSettings;
  onAddToPortfolio?: (assignment: PortfolioAssignment) => void;
}

interface DealForm {
  name: string;
  contractType: ContractType;
  hours: number;
  hourlyRate: number;
  fixedPrice: number;
  startDate: string;
  endDate: string;
}

export function DealCalculator({ settings, onAddToPortfolio }: DealCalculatorProps) {
  const safeSettings = getSafeSettings(settings);

  const [form, setForm] = useState<DealForm>({
    name: "",
    contractType: "timpris",
    hours: 160,
    hourlyRate: 1000,
    fixedPrice: 0,
    startDate: "",
    endDate: "",
  });

  const results = useMemo(() => {
    // L8 FIX: Use effective hours (after absence deductions) for consistent revenue calc
    // across the deal calculator and portfolio engine.
    let effectiveHours = form.hours;
    let theoreticalHours = form.hours;
    let absenceDeduction = 0;

    if (form.startDate && form.endDate && form.hours > 0) {
      const preview: PortfolioAssignment = {
        id: "preview",
        name: form.name || "Preview",
        startDate: form.startDate,
        endDate: form.endDate,
        contractType: form.contractType,
        hourlyRate: form.hourlyRate,
        fixedPrice: form.fixedPrice,
        hours: form.hours,
        isFromSystem: false,
        distributionMode: "even",
      };
      const eff = calculateEffectiveHours(preview, safeSettings);
      effectiveHours = eff.effective;
      theoreticalHours = eff.theoretical;
      absenceDeduction = eff.deduction;
    }

    let grossRevenue = 0;

    // BUG-FIX: Använd theoretical (= bokade timmar) för intäkten, inte effective.
    // Frånvaroavdraget är kapacitetsplanering — det ska inte sänka intäkten på
    // ett konkret bokat uppdrag. Effektiva timmar visas separat som FYI.
    switch (form.contractType) {
      case "timpris":
        grossRevenue = theoreticalHours * form.hourlyRate;
        break;
      case "fastpris":
      case "fastpris_overtid":
        grossRevenue = form.fixedPrice;
        break;
      case "blandat":
        grossRevenue = form.fixedPrice + theoreticalHours * form.hourlyRate;
        break;
    }

    const commission = grossRevenue * safeSettings.brokerCommissionRate;
    const netRevenue = grossRevenue - commission;

    // Calculate costs for the deal duration
    const startDate = form.startDate ? new Date(form.startDate) : null;
    const endDate = form.endDate ? new Date(form.endDate) : null;
    let months = 1;
    if (startDate && endDate) {
      months = Math.max(
        1,
        (endDate.getFullYear() - startDate.getFullYear()) * 12 +
          (endDate.getMonth() - startDate.getMonth()) +
          1
      );
    }

    const employerTax = safeSettings.monthlySalaryGross * safeSettings.employerTaxRate;
    const monthlyCost =
      safeSettings.monthlySalaryGross +
      employerTax +
      safeSettings.monthlyOverhead +
      safeSettings.brokerMonthlyFee;
    const totalCosts = monthlyCost * months;

    const profit = netRevenue - totalCosts;
    const margin = grossRevenue > 0 ? (profit / grossRevenue) * 100 : 0;

    return {
      grossRevenue,
      commission,
      netRevenue,
      totalCosts,
      profit,
      margin,
      months,
      effectiveHours,
      theoreticalHours,
      absenceDeduction,
    };
  }, [form, safeSettings]);

  const handleAddToPortfolio = () => {
    if (!onAddToPortfolio || !form.name) return;

    const assignment: PortfolioAssignment = {
      id: crypto.randomUUID(),
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
      contractType: form.contractType,
      hourlyRate: form.hourlyRate,
      fixedPrice: form.fixedPrice,
      hours: form.hours,
      isFromSystem: false,
      distributionMode: "even",
    };
    onAddToPortfolio(assignment);
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Input form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Affärsdetaljer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Uppdragsnamn</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="T.ex. Konsultuppdrag AB"
            />
          </div>

          <div className="space-y-2">
            <Label>Kontraktstyp</Label>
            <Select
              value={form.contractType}
              onValueChange={(v) =>
                setForm({ ...form, contractType: v as ContractType })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONTRACT_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Timmar</Label>
              <Input
                type="number"
                value={form.hours}
                onChange={(e) =>
                  setForm({ ...form, hours: Number(e.target.value) })
                }
              />
            </div>
            {(form.contractType === "timpris" ||
              form.contractType === "blandat" ||
              form.contractType === "fastpris_overtid") && (
              <div className="space-y-2">
                <Label>Timpris (SEK)</Label>
                <Input
                  type="number"
                  value={form.hourlyRate}
                  onChange={(e) =>
                    setForm({ ...form, hourlyRate: Number(e.target.value) })
                  }
                />
              </div>
            )}
          </div>

          {(form.contractType === "fastpris" ||
            form.contractType === "blandat" ||
            form.contractType === "fastpris_overtid") && (
            <div className="space-y-2">
              <Label>Fastpris (SEK)</Label>
              <Input
                type="number"
                value={form.fixedPrice}
                onChange={(e) =>
                  setForm({ ...form, fixedPrice: Number(e.target.value) })
                }
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Startdatum</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Slutdatum</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resultat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {results.absenceDeduction > 0 && (
              <div className="rounded-md border bg-amber-500/5 border-amber-500/30 p-2 text-xs space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Teoretiska timmar</span>
                  <span>{results.theoreticalHours.toFixed(0)}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    &minus; Frånvaroavdrag
                  </span>
                  <span>&minus;{results.absenceDeduction}h</span>
                </div>
                <div className="flex justify-between font-medium pt-0.5 border-t border-amber-500/20">
                  <span>= Effektiva timmar</span>
                  <span>{results.effectiveHours.toFixed(0)}h</span>
                </div>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Bruttointäkt</span>
              <span className="font-medium">
                {formatCurrency(results.grossRevenue)}
              </span>
            </div>
            <div className="flex justify-between text-red-600">
              <span className="text-sm">
                Provision ({Math.round(safeSettings.brokerCommissionRate * 100)}%)
              </span>
              <span className="font-medium">
                -{formatCurrency(results.commission)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Nettointäkt</span>
              <span className="font-medium">
                {formatCurrency(results.netRevenue)}
              </span>
            </div>
            <div className="flex justify-between text-red-600">
              <span className="text-sm">
                Kostnader ({results.months} mån)
              </span>
              <span className="font-medium">
                -{formatCurrency(results.totalCosts)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg">
              <span className="font-medium">Vinst</span>
              <span
                className={`font-bold ${results.profit >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {formatCurrency(results.profit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Marginal</span>
              <span
                className={`font-medium ${results.margin >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {results.margin.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Visual indicators */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-lg border p-3 text-center">
              <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-600" />
              <p className="text-xs text-muted-foreground">Nettointäkt</p>
              <p className="text-sm font-bold text-green-600">
                {formatCurrency(results.netRevenue)}
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <TrendingDown className="w-5 h-5 mx-auto mb-1 text-red-600" />
              <p className="text-xs text-muted-foreground">Kostnader</p>
              <p className="text-sm font-bold text-red-600">
                {formatCurrency(results.totalCosts)}
              </p>
            </div>
          </div>

          <Button
            className="w-full mt-4"
            onClick={handleAddToPortfolio}
            disabled={!form.name || !form.startDate || !form.endDate}
          >
            <Plus className="w-4 h-4 mr-1" />
            Lägg till portföljen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
