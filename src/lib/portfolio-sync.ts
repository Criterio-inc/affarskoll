// Portfolio sync: bridge between Project (db entity) and PortfolioAssignment (forecast model)
// Fas 4.2 + 4.3 — projects are the single source of truth; portfolio stores only manual entries + overrides.

import type { Project } from "@/types/project";
import type { PortfolioAssignment } from "@/types/portfolio";

/**
 * Convert a Project to a PortfolioAssignment for forecasting.
 */
export function projectToPortfolioAssignment(project: Project): PortfolioAssignment {
  return {
    id: project.id,                       // Reuse project id so sync is stable
    projectId: project.id,
    name: project.title,
    customerName: project.customerName,
    startDate: project.startDate,
    endDate: project.endDate,
    contractType: project.contractType,
    hourlyRate: project.hourlyRate !== undefined ? Number(project.hourlyRate) : undefined,
    fixedPrice: project.fixedPrice !== undefined ? Number(project.fixedPrice) : undefined,
    hours: Number(project.budgetedHours ?? 0),
    isFromSystem: true,
    distributionMode: project.usePhaseDistribution ? "phases" : "even",
    phases: project.phases,
    revenueLagMonths: project.revenueLagMonths,
    skipAbsenceDeduction: project.skipAbsenceDeduction,
    // Undantaget från Förmedlingsprovision → 0 % i prognosmotorn så netto/runway stämmer.
    ...(project.brokerCommissionExempt
      ? { useCustomSettings: true, overrides: { brokerCommissionRate: 0 } }
      : {}),
  };
}

export interface PortfolioDiff {
  field: string;
  label: string;
  projectValue: string | number | undefined;
  portfolioValue: string | number | undefined;
}

/**
 * Compare a synced portfolio assignment with its source project.
 * Returns a list of fields that have drifted.
 */
export function diffPortfolioFromProject(
  portfolio: PortfolioAssignment,
  project: Project
): PortfolioDiff[] {
  const diffs: PortfolioDiff[] = [];
  const p = projectToPortfolioAssignment(project);

  if (portfolio.name !== p.name) {
    diffs.push({
      field: "name",
      label: "Namn",
      projectValue: p.name,
      portfolioValue: portfolio.name,
    });
  }
  if (portfolio.startDate !== p.startDate) {
    diffs.push({
      field: "startDate",
      label: "Startdatum",
      projectValue: p.startDate,
      portfolioValue: portfolio.startDate,
    });
  }
  if (portfolio.endDate !== p.endDate) {
    diffs.push({
      field: "endDate",
      label: "Slutdatum",
      projectValue: p.endDate,
      portfolioValue: portfolio.endDate,
    });
  }
  if (portfolio.contractType !== p.contractType) {
    diffs.push({
      field: "contractType",
      label: "Avtalstyp",
      projectValue: p.contractType,
      portfolioValue: portfolio.contractType,
    });
  }
  if ((portfolio.hourlyRate ?? 0) !== (p.hourlyRate ?? 0)) {
    diffs.push({
      field: "hourlyRate",
      label: "Timpris",
      projectValue: p.hourlyRate,
      portfolioValue: portfolio.hourlyRate,
    });
  }
  if ((portfolio.fixedPrice ?? 0) !== (p.fixedPrice ?? 0)) {
    diffs.push({
      field: "fixedPrice",
      label: "Fastpris",
      projectValue: p.fixedPrice,
      portfolioValue: portfolio.fixedPrice,
    });
  }
  if ((portfolio.hours ?? 0) !== (p.hours ?? 0)) {
    diffs.push({
      field: "hours",
      label: "Budgeterade timmar",
      projectValue: p.hours,
      portfolioValue: portfolio.hours,
    });
  }

  return diffs;
}

export interface SyncedPortfolioResult {
  merged: PortfolioAssignment[];                    // Projects (system) + manual entries
  driftedIds: string[];                             // System entries that diverge from their source
  diffs: Record<string, PortfolioDiff[]>;           // id → diff list
  manualCount: number;
  systemCount: number;
}

/**
 * Merge saved portfolio with live project data.
 *
 * Rules:
 * - For every aktiv project, include a synced assignment.
 *   If the portfolio has an override (edited after sync), detect drift.
 * - Keep all manual entries (isFromSystem: false OR no projectId).
 */
export function mergePortfolioWithProjects(
  savedPortfolio: PortfolioAssignment[],
  projects: Project[],
  options: { includeProspekt?: boolean } = {}
): SyncedPortfolioResult {
  const { includeProspekt = false } = options;

  // Eligible projects: aktiv by default, optionally include prospekt
  const relevantProjects = projects.filter(
    (p) => p.status === "aktiv" || (includeProspekt && p.status === "prospekt")
  );

  const projectById = new Map(relevantProjects.map((p) => [p.id, p]));
  const savedByProjectId = new Map(
    savedPortfolio
      .filter((a) => a.projectId && a.isFromSystem)
      .map((a) => [a.projectId!, a])
  );

  const merged: PortfolioAssignment[] = [];
  const driftedIds: string[] = [];
  const diffs: Record<string, PortfolioDiff[]> = {};

  // 1. Synced entries from projects (with saved overrides if any)
  for (const project of relevantProjects) {
    const saved = savedByProjectId.get(project.id);
    const fromProject = projectToPortfolioAssignment(project);

    if (saved) {
      // Use saved version but flag drift
      const drift = diffPortfolioFromProject(saved, project);
      if (drift.length > 0) {
        driftedIds.push(saved.id);
        diffs[saved.id] = drift;
      }
      merged.push(saved);
    } else {
      merged.push(fromProject);
    }
  }

  // 2. Manual entries (never synced from a project)
  for (const a of savedPortfolio) {
    const isOrphan = a.projectId && !projectById.has(a.projectId);
    const isManual = !a.isFromSystem || !a.projectId;

    if (isManual) {
      merged.push(a);
    } else if (isOrphan) {
      // Project was deleted or archived — keep but mark drifted
      merged.push(a);
      driftedIds.push(a.id);
      diffs[a.id] = [
        {
          field: "projectId",
          label: "Kallprojekt",
          projectValue: "(saknas)",
          portfolioValue: a.projectId,
        },
      ];
    }
  }

  const manualCount = merged.filter((a) => !a.isFromSystem).length;
  const systemCount = merged.length - manualCount;

  return { merged, driftedIds, diffs, manualCount, systemCount };
}
