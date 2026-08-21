"use client";

import { useMemo } from "react";
import { Clock, DollarSign, Receipt, TrendingUp } from "lucide-react";
import { useProjects } from "@/hooks/use-projects";
import { useTimeEntries } from "@/hooks/use-time-entries";
import { useSettings } from "@/hooks/use-settings";
import { useSyncedPortfolio } from "@/hooks/use-portfolio";
import { useNotificationGenerator } from "@/hooks/use-notification-generator";
import { getSafeSettings } from "@/lib/settings";
import { formatCurrency, formatCompact } from "@/lib/utils";
import { netRevenueForProject, isBillableEntry } from "@/lib/revenue";
import { calculateMonthlyCosts } from "@/lib/calculator-engine";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { PipelineStatusWidget } from "@/components/dashboard/pipeline-status";
import { AllProjectsSection } from "@/components/dashboard/all-projects-section";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { PortfolioForecastWidget } from "@/components/dashboard/portfolio-forecast-widget";
import { RunwayCard } from "@/components/dashboard/runway-card";
import { UtilizationCard } from "@/components/dashboard/utilization-card";
import { InvoicingQueue } from "@/components/dashboard/invoicing-queue";
import { PipelineFunnel } from "@/components/dashboard/pipeline-funnel";
import { RevenueByProject } from "@/components/dashboard/revenue-by-project";

// Swedish month names for the header
const MONTH_NAMES = [
  "januari",
  "februari",
  "mars",
  "april",
  "maj",
  "juni",
  "juli",
  "augusti",
  "september",
  "oktober",
  "november",
  "december",
];

export default function DashboardPage() {
  const { data: projects = [], isLoading: loadingProjects } = useProjects();
  const { data: timeEntries = [], isLoading: loadingEntries } = useTimeEntries();
  const { data: settingsData, isLoading: loadingSettings } = useSettings();
  const { merged: portfolioAssignments } = useSyncedPortfolio();

  // Fas 5.1: regenerate notifications on dashboard mount (rate-limited to 6h)
  useNotificationGenerator();

  const settings = useMemo(
    () => getSafeSettings(settingsData ?? null),
    [settingsData]
  );

  const now = new Date();
  const currentMonth = MONTH_NAMES[now.getMonth()];
  const currentYear = now.getFullYear();
  const currentMonthStr = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // ---- Compute monthly stats with useMemo ----
  const monthlyStats = useMemo(() => {
    // 1. Filter time entries for the current month
    const monthEntries = timeEntries.filter((e) =>
      e.date.startsWith(currentMonthStr)
    );

    // 2. Total worked hours this month
    const totalHours = monthEntries.reduce(
      (sum, e) => sum + (Number(e.hours) || 0),
      0
    );

    // 3. Build a lookup of hours per project this month (total and billable)
    const hoursPerProject: Record<
      string,
      { total: number; billable: number }
    > = {};
    for (const entry of monthEntries) {
      if (!hoursPerProject[entry.projectId]) {
        hoursPerProject[entry.projectId] = { total: 0, billable: 0 };
      }
      const h = Number(entry.hours) || 0;
      hoursPerProject[entry.projectId].total += h;
      if (isBillableEntry(entry)) {
        hoursPerProject[entry.projectId].billable += h;
      }
    }

    // 4. Calculate revenue (net after broker commission) via shared model.
    //    Provisionen dras av per uppdrag, så uppdrag som är undantagna (provisions-
    //    avgift borttagen) får full intäkt. Arkiverade uppdrag räknas inte med
    //    (avslutade gör det — arbete = intäkt).
    let netRevenue = 0;
    const commissionRate = settings.brokerCommissionRate;

    for (const project of projects) {
      if (project.status === "arkiverad") continue;
      const projectHours = hoursPerProject[project.id];
      if (!projectHours) continue;
      netRevenue += netRevenueForProject(project, projectHours, commissionRate);
    }

    // 5. Månadskostnad via EN gemensam formel (samma som break-even/prognos/
    //    runway): lön + arbetsgivaravgift + overhead + förmedlingsavgift + projektutgifter.
    const fullMonthCosts = calculateMonthlyCosts(settings, true, true).total;

    // Periodisera kostnaden till hittills-i-månaden så Nettoresultat blir
    // jämförbart med intäkten (som ackumuleras dag för dag).
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();
    const monthFraction = Math.min(1, now.getDate() / daysInMonth);
    const totalCosts = fullMonthCosts * monthFraction;

    // 6. Net result (hittills i månaden)
    const netResult = netRevenue - totalCosts;

    return {
      totalHours,
      netRevenue,
      totalCosts,
      fullMonthCosts,
      netResult,
    };
  }, [timeEntries, projects, settings, currentMonthStr, now]);

  const isLoading = loadingProjects || loadingEntries || loadingSettings;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Översikt"
        description={`${currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1)} ${currentYear}`}
      />

      {/* KPI stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Arbetade timmar"
          value={isLoading ? "..." : `${monthlyStats.totalHours.toFixed(1)}h`}
          subtitle="denna månad"
          icon={Clock}
        />
        <StatCard
          title="Intäkt (netto)"
          value={isLoading ? "..." : formatCurrency(monthlyStats.netRevenue)}
          valueCompact={isLoading ? "..." : `${formatCompact(monthlyStats.netRevenue)} kr`}
          subtitle="efter provision"
          icon={DollarSign}
          variant="primary"
        />
        <StatCard
          title="Kostnader"
          value={isLoading ? "..." : formatCurrency(monthlyStats.totalCosts)}
          valueCompact={isLoading ? "..." : `${formatCompact(monthlyStats.totalCosts)} kr`}
          subtitle="hittills i månaden"
          icon={Receipt}
        />
        <StatCard
          title="Nettoresultat"
          value={isLoading ? "..." : formatCurrency(monthlyStats.netResult)}
          valueCompact={isLoading ? "..." : `${formatCompact(monthlyStats.netResult)} kr`}
          subtitle="hittills i månaden"
          icon={TrendingUp}
          variant={monthlyStats.netResult >= 0 ? "accent" : "default"}
        />
      </div>

      {/* Widgets row 1: hälsoindikatorer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <RunwayCard
          assignments={portfolioAssignments}
          settings={settings}
          cashBuffer={settings.cashBuffer}
        />
        <PipelineStatusWidget projects={projects} />
        <UtilizationCard timeEntries={timeEntries} settings={settings} />
      </div>

      {/* Widgets row 2: prognos och historik */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <PortfolioForecastWidget />
        <RevenueChart
          projects={projects}
          timeEntries={timeEntries}
          commissionRate={settings.brokerCommissionRate}
        />
      </div>

      {/* Intäkt per uppdrag — var intäkts-KPI:n kommer ifrån */}
      <RevenueByProject
        projects={projects}
        timeEntries={timeEntries}
        commissionRate={settings.brokerCommissionRate}
      />

      {/* Widgets row 3: fakturering och pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <InvoicingQueue projects={projects} timeEntries={timeEntries} />
        <PipelineFunnel projects={projects} months={12} />
      </div>

      {/* All projects */}
      <AllProjectsSection projects={projects} timeEntries={timeEntries} />
    </div>
  );
}
