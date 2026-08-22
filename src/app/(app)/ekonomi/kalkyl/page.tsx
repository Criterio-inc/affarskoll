"use client";

import { useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSettings } from "@/hooks/use-settings";
import { usePortfolio, useUpdatePortfolio } from "@/hooks/use-portfolio";
import {
  useSavedCalculations,
  useDeleteSavedCalculation,
} from "@/hooks/use-saved-calculations";
import { DealCalculator } from "@/components/calculator/deal-calculator";
import {
  DividendPlanner,
  PricingCalculator,
} from "@/components/calculator/dividend-planner";
import { PortfolioAssignment } from "@/types/portfolio";
import { getSafeSettings } from "@/lib/settings";
import { formatCurrency } from "@/lib/utils";
import {
  GitCompare,
  Wallet,
  BookMarked,
  Loader2,
  Trash2,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

export default function KalkylatorPage() {
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: savedAssignments = [] } = usePortfolio();
  const updatePortfolio = useUpdatePortfolio();
  const { data: savedCalcs = [], isLoading: savedLoading } =
    useSavedCalculations();
  const deleteCalc = useDeleteSavedCalculation();

  const safeSettings = getSafeSettings(settings);

  // Jämför-fliken kan lägga ett scenario i portföljen (syns i dashboardens prognos).
  const handleAddToPortfolio = useCallback(
    (assignment: PortfolioAssignment) => {
      const updated = [...savedAssignments, assignment];
      updatePortfolio.mutate(updated, {
        onSuccess: () => toast.success("Uppdrag tillagt i portföljen"),
        onError: () => toast.error("Kunde inte lägga till uppdrag"),
      });
    },
    [savedAssignments, updatePortfolio]
  );

  const handleDeleteSavedCalc = useCallback(
    (id: string) => {
      deleteCalc.mutate(id, {
        onSuccess: () => toast.success("Beräkning borttagen"),
        onError: () => toast.error("Kunde inte ta bort beräkning"),
      });
    },
    [deleteCalc]
  );

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="jamfor" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="jamfor" className="px-1 text-xs sm:text-sm sm:gap-1.5">
            <GitCompare className="w-3.5 h-3.5 shrink-0 hidden sm:block" />
            Jämför
          </TabsTrigger>
          <TabsTrigger value="nettolon" className="px-1 text-xs sm:text-sm sm:gap-1.5">
            <Wallet className="w-3.5 h-3.5 shrink-0 hidden sm:block" />
            Nettolön
          </TabsTrigger>
          <TabsTrigger value="sparade" className="px-1 text-xs sm:text-sm sm:gap-1.5">
            <BookMarked className="w-3.5 h-3.5 shrink-0 hidden sm:block" />
            Sparade
          </TabsTrigger>
        </TabsList>

        {/* JAMFOR TAB */}
        <TabsContent value="jamfor">
          <DealCalculator
            settings={safeSettings}
            onAddToPortfolio={handleAddToPortfolio}
          />
        </TabsContent>

        {/* NETTOLON TAB */}
        <TabsContent value="nettolon">
          <div className="grid md:grid-cols-2 gap-6">
            <PricingCalculator settings={safeSettings} />
            <DividendPlanner settings={safeSettings} />
          </div>
        </TabsContent>

        {/* SPARADE TAB */}
        <TabsContent value="sparade">
          {savedLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : savedCalcs.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <BookMarked className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  Inga sparade beräkningar
                </h3>
                <p className="text-muted-foreground">
                  Sparade beräkningar från Jämför-fliken visas här.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedCalcs.map((calc) => (
                <Card key={calc.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{calc.name}</CardTitle>
                        {calc.projectName && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {calc.projectName}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDeleteSavedCalc(calc.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {calc.startDate} - {calc.endDate}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {calc.contractType}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {calc.hours}h
                      </span>
                    </div>
                    <Separator className="my-2" />
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Brutto</span>
                        <span>{formatCurrency(calc.grossRevenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Netto</span>
                        <span>{formatCurrency(calc.netRevenue)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Vinst</span>
                        <span
                          className={
                            calc.netProfit >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {formatCurrency(calc.netProfit)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Marginal</span>
                        <span>{calc.profitMargin.toFixed(1)}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
