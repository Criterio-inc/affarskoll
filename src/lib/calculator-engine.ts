// ============================================================================
// CENTRALIZED CALCULATOR ENGINE
// All calculation logic in ONE place. Components import from HERE ONLY.
//
// Fixes applied:
//   B1 - Phase overlap validation: phases must not overlap in time
//   B3 - Consistent cost calculation: uses the same cost formula everywhere
// ============================================================================

import {
  differenceInMonths,
  differenceInCalendarDays,
  parseISO,
  isValid,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  isWithinInterval,
  addMonths,
  addDays,
  format,
  min,
  max,
  isWeekend,
} from 'date-fns';
import { sv } from 'date-fns/locale';
import { AppSettings, getSafeSettings as getSafeSettingsBase } from '@/lib/settings';
import {
  PortfolioAssignment,
  AssignmentPhase,
  MonthlyData,
  DistributionMode,
} from '@/types/portfolio';
import {
  calculateAbsenceDeductions,
  calculateAssignmentEffectiveHours,
  AbsenceSettings,
} from '@/lib/absence-calculations';

// ============================================================================
// SAFE SETTINGS - Re-export from settings.ts (single source of truth)
// ============================================================================

export const getSafeSettings = getSafeSettingsBase;

/**
 * Extract absence settings from full settings object.
 * SINGLE SOURCE OF TRUTH - use this everywhere, do not redefine!
 */
export const getAbsenceSettings = (settings: AppSettings): AbsenceSettings => ({
  vacationWeeks: settings.vacationWeeks,
  vacationMonths: settings.vacationMonths,
  vacationMonthThreshold: settings.vacationMonthThreshold,
  publicHolidayHoursPerYear: settings.publicHolidayHoursPerYear,
  internalTimeHoursPerYear: settings.internalTimeHoursPerYear,
  sickLeaveHoursPerYear: settings.sickLeaveHoursPerYear,
  applyAbsenceDeductions: settings.applyAbsenceDeductions,
});

// ============================================================================
// SAFE DATE PARSING - Defensive date handling
// ============================================================================

export const safeParseDate = (dateString: string | undefined | null): Date | null => {
  if (!dateString) return null;
  try {
    const parsed = parseISO(dateString);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const safeFormatDate = (
  dateString: string | undefined | null,
  formatStr: string = 'd MMM yyyy'
): string => {
  const parsed = safeParseDate(dateString);
  if (!parsed) return '-';
  try {
    return format(parsed, formatStr, { locale: sv });
  } catch {
    return '-';
  }
};

// ============================================================================
// WORKING DAYS CALCULATION
// ============================================================================

/**
 * Count working days (Monday-Friday) in a date range (inclusive).
 */
export const countWorkingDays = (startDate: string, endDate: string): number => {
  const start = safeParseDate(startDate);
  const end = safeParseDate(endDate);
  if (!start || !end || start > end) return 0;

  let count = 0;
  let current = new Date(start);
  while (current <= end) {
    if (!isWeekend(current)) {
      count++;
    }
    current = addDays(current, 1);
  }
  return count;
};

/**
 * Calculate hours from working days and allocation percentage.
 * 100% = 8h per working day, 50% = 4h per working day, etc.
 */
export const calculateHoursFromAllocation = (
  startDate: string,
  endDate: string,
  allocationPercentage: number
): number => {
  const workingDays = countWorkingDays(startDate, endDate);
  return Math.round(workingDays * 8 * (allocationPercentage / 100));
};

// ============================================================================
// ASSIGNMENT & PHASE VALIDATION
// ============================================================================

export const isValidAssignment = (
  a: PortfolioAssignment | null | undefined
): a is PortfolioAssignment => {
  if (!a) return false;
  if (!a.id || !a.name) return false;
  if (!a.startDate || !a.endDate) return false;

  const start = safeParseDate(a.startDate);
  const end = safeParseDate(a.endDate);
  if (!start || !end) return false;

  return true;
};

export const isValidPhase = (p: AssignmentPhase | null | undefined): p is AssignmentPhase => {
  if (!p) return false;
  if (!p.id || !p.name) return false;
  if (!p.startDate || !p.endDate) return false;
  if (typeof p.hours !== 'number') return false;

  const start = safeParseDate(p.startDate);
  const end = safeParseDate(p.endDate);
  if (!start || !end) return false;

  return true;
};

export const getValidAssignments = (
  assignments: PortfolioAssignment[] | null | undefined
): PortfolioAssignment[] => {
  if (!Array.isArray(assignments)) return [];
  return assignments.filter(isValidAssignment);
};

export const getValidPhases = (
  phases: AssignmentPhase[] | null | undefined
): AssignmentPhase[] => {
  if (!Array.isArray(phases)) return [];
  return phases.filter(isValidPhase);
};

// ============================================================================
// B1 FIX: PHASE OVERLAP VALIDATION
// ============================================================================

export interface PhaseOverlapError {
  phaseA: string;
  phaseB: string;
  overlapStart: string;
  overlapEnd: string;
}

/**
 * Check whether any phases in the list overlap in time.
 * Returns an array of overlap errors (empty if no overlaps).
 *
 * FIX B1: Phases within an assignment must not overlap. Overlapping phases
 * would double-count hours in the monthly forecast, leading to incorrect
 * revenue and cost projections.
 */
export const detectPhaseOverlaps = (phases: AssignmentPhase[]): PhaseOverlapError[] => {
  const valid = getValidPhases(phases);
  const errors: PhaseOverlapError[] = [];

  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const aStart = safeParseDate(valid[i].startDate)!;
      const aEnd = safeParseDate(valid[i].endDate)!;
      const bStart = safeParseDate(valid[j].startDate)!;
      const bEnd = safeParseDate(valid[j].endDate)!;

      // Two intervals [aStart, aEnd] and [bStart, bEnd] overlap iff
      // aStart <= bEnd AND bStart <= aEnd
      if (aStart <= bEnd && bStart <= aEnd) {
        const overlapStart = max([aStart, bStart]);
        const overlapEnd = min([aEnd, bEnd]);
        errors.push({
          phaseA: valid[i].name,
          phaseB: valid[j].name,
          overlapStart: format(overlapStart, 'yyyy-MM-dd'),
          overlapEnd: format(overlapEnd, 'yyyy-MM-dd'),
        });
      }
    }
  }

  return errors;
};

// ============================================================================
// DISTRIBUTION MODE HELPERS
// ============================================================================

/**
 * Get the effective distribution mode for an assignment.
 * Handles migration from legacy usePhaseDistribution boolean to distributionMode.
 */
export const getDistributionMode = (assignment: PortfolioAssignment): DistributionMode => {
  // New property takes precedence
  if (assignment.distributionMode) {
    return assignment.distributionMode;
  }

  // Legacy migration: usePhaseDistribution boolean
  if (assignment.usePhaseDistribution && assignment.phases?.length) {
    return 'phases';
  }

  // Check for monthly allocations
  if (assignment.monthlyAllocations?.length) {
    return 'monthly';
  }

  return 'even';
};

/**
 * Get total hours based on distribution mode.
 * Monthly mode: sum of all monthly allocations
 * Phase mode: sum of all phase hours
 * Even mode: assignment.hours
 */
export const getTotalHoursForMode = (assignment: PortfolioAssignment): number => {
  const mode = getDistributionMode(assignment);

  if (mode === 'monthly' && assignment.monthlyAllocations?.length) {
    return assignment.monthlyAllocations.reduce(
      (sum: number, a: { hours: number }) => sum + (a.hours || 0),
      0
    );
  }

  if (mode === 'phases' && assignment.phases?.length) {
    return getValidPhases(assignment.phases).reduce((sum, p) => sum + (p.hours || 0), 0);
  }

  return assignment.hours || 0;
};

// ============================================================================
// EFFECTIVE HOURS - After absence deductions
// ============================================================================

export interface EffectiveHoursResult {
  theoretical: number;
  effective: number;
  deduction: number;
  hasDeduction: boolean;
}

/**
 * Calculate effective hours for an assignment (after absence deductions).
 * SINGLE SOURCE OF TRUTH - use this everywhere!
 */
export const calculateEffectiveHours = (
  assignment: PortfolioAssignment,
  settings: AppSettings
): EffectiveHoursResult => {
  const absenceSettings = getAbsenceSettings(settings);
  const mode = getDistributionMode(assignment);

  // Get theoretical hours based on distribution mode
  const theoreticalHours = getTotalHoursForMode(assignment);

  // Per-assignment control - skip deductions for part-time/flexible assignments
  if (assignment.skipAbsenceDeduction || !absenceSettings.applyAbsenceDeductions) {
    return {
      theoretical: theoreticalHours,
      effective: theoreticalHours,
      deduction: 0,
      hasDeduction: false,
    };
  }

  // Calculate absence deductions based on mode
  if (mode === 'phases' && assignment.phases?.length) {
    const validPhases = getValidPhases(assignment.phases);
    const result = calculateAssignmentEffectiveHours(
      validPhases.map((p) => ({ startDate: p.startDate, endDate: p.endDate, hours: p.hours })),
      assignment.startDate,
      assignment.endDate,
      absenceSettings
    );
    return {
      theoretical: result.theoreticalHours,
      effective: result.effectiveHours,
      deduction: result.totalDeduction,
      hasDeduction: result.totalDeduction > 0,
    };
  } else {
    // For 'even' and 'monthly' modes, apply standard deduction
    const deduction = calculateAbsenceDeductions(
      theoreticalHours,
      assignment.startDate,
      assignment.endDate,
      absenceSettings
    );
    return {
      theoretical: theoreticalHours,
      effective: deduction.effectiveHours,
      deduction: deduction.totalDeduction,
      hasDeduction: deduction.totalDeduction > 0,
    };
  }
};

// ============================================================================
// REVENUE CALCULATIONS
// ============================================================================

/**
 * Calculate total gross revenue for an assignment.
 *
 * BUG-FIX: Använder THEORETICAL hours (= bokade/planerade timmar),
 * INTE effective hours efter frånvaroavdrag. Resonemang:
 *
 *   Frånvaroavdraget är en KAPACITETSPLANERING ("hur mycket realistiskt
 *   kan jag jobba per år"), inte en INTÄKTSMULTIPLIKATOR. Om du bokat
 *   1044h på 803 kr/h och jobbar dem, fakturerar du 838 332 kr.
 *
 *   Tidigare returnerades `effective * rate` vilket gjorde att prognosens
 *   summa blev mindre än uppdragsvärdet i portfölj-listan. Inkonsekvent.
 *
 *   Frånvaroavdraget används istället för att flagga om bokad portfölj
 *   överstiger tillgänglig kapacitet (separat varning, inte intäkts-rabatt).
 */
export const calculateAssignmentRevenue = (
  assignment: PortfolioAssignment,
  _settings: AppSettings
): number => {
  const totalHours = getTotalHoursForMode(assignment);
  const { contractType, fixedPrice = 0, hourlyRate = 0 } = assignment;

  if (contractType === 'fastpris' || contractType === 'fastpris_overtid') {
    return fixedPrice;
  } else if (contractType === 'timpris') {
    return totalHours * hourlyRate;
  } else if (contractType === 'blandat') {
    return fixedPrice + totalHours * hourlyRate;
  }
  return 0;
};

// ============================================================================
// PORTFOLIO SUMMARY
// ============================================================================

export interface PortfolioSummary {
  totalGross: number;
  brokerCommissionTotal: number;
  totalNet: number;
  assignmentCount: number;
  linkedCount: number;
  manualCount: number;
}

export const calculatePortfolioSummary = (
  assignments: PortfolioAssignment[],
  settings: AppSettings
): PortfolioSummary => {
  const validAssignments = getValidAssignments(assignments);

  // Förmedlingsprovision dras per uppdrag (respekterar undantag/override), inte
  // med en global sats på totalen.
  let totalGross = 0;
  let totalNet = 0;
  for (const a of validAssignments) {
    const gross = calculateAssignmentRevenue(a, settings);
    const rate = getAssignmentEffectiveSettings(a, settings).brokerCommissionRate;
    totalGross += gross;
    totalNet += gross * (1 - rate);
  }
  const brokerCommissionTotal = totalGross - totalNet;

  return {
    totalGross,
    brokerCommissionTotal,
    totalNet,
    assignmentCount: validAssignments.length,
    linkedCount: validAssignments.filter((a) => a.isFromSystem).length,
    manualCount: validAssignments.filter((a) => !a.isFromSystem).length,
  };
};

// ============================================================================
// MONTHLY COSTS
// B3 FIX: Consistent cost calculation
// The same formula is used in calculateMonthlyCosts, calculateBreakEvenThreshold,
// and the monthly forecast loop. Previously there were subtle differences.
// ============================================================================

export interface MonthlyCostBreakdown {
  overheadCost: number;
  salaryCost: number;
  total: number;
}

/**
 * Compute the salary cost line item (gross + employer tax).
 * Extracted as a helper so that all cost paths use the exact same formula (B3 fix).
 */
const computeSalaryCost = (settings: AppSettings): number => {
  return settings.monthlySalaryGross * (1 + settings.employerTaxRate);
};

/**
 * Compute the overhead cost line item (overhead + broker monthly fee).
 * Extracted as a helper for consistency (B3 fix).
 */
const computeOverheadCost = (settings: AppSettings): number => {
  // Löpande månadskostnad: overhead + förmedlingsavgift + projektutgifter
  // (bank, bokföring, AI-tjänster). fixedMonthlyCosts räknas EJ (överlappade).
  return (
    settings.monthlyOverhead +
    settings.brokerMonthlyFee +
    (settings.projectExpenses ?? 0)
  );
};

/**
 * Calculate monthly costs broken down by overhead and salary.
 *
 * - Overhead is charged when there is active work being performed.
 * - Salary is charged when the invoiced month had full booking (see isFullyBookedMonth).
 */
export const calculateMonthlyCosts = (
  settings: AppSettings,
  hasActiveWork: boolean,
  hasRevenue: boolean
): MonthlyCostBreakdown => {
  const overheadCost = hasActiveWork ? computeOverheadCost(settings) : 0;
  const salaryCost = hasRevenue ? computeSalaryCost(settings) : 0;

  return {
    overheadCost,
    salaryCost,
    total: overheadCost + salaryCost,
  };
};

/**
 * Calculate break-even threshold (total monthly costs when fully active with revenue).
 * Uses the same helpers as calculateMonthlyCosts for consistency (B3 fix).
 */
export const calculateBreakEvenThreshold = (settings: AppSettings): number => {
  return computeSalaryCost(settings) + computeOverheadCost(settings);
};

/**
 * Full beläggning: minst 80 % av normal månadsbeläggning
 * (targetBillableHoursPerYear / 12). Styr lönen i prognosen och
 * "bokad beläggning" på Runway-kortet.
 */
export const FULL_BOOKING_SHARE = 0.8;

export const isFullyBookedMonth = (hours: number, settings: AppSettings): boolean => {
  const monthlyTarget = (settings.targetBillableHoursPerYear || 1400) / 12;
  return hours >= monthlyTarget * FULL_BOOKING_SHARE;
};

// ============================================================================
// MONTHLY FORECAST DATA
// ============================================================================

export interface MonthlyForecastInput {
  assignments: PortfolioAssignment[];
  settings: AppSettings;
  year?: number;
}

/**
 * Calculate worked hours for a specific month based on distribution mode.
 */
const calculateWorkedHoursForMonth = (
  assignment: PortfolioAssignment,
  monthStart: Date,
  monthEnd: Date
): number => {
  const aStart = safeParseDate(assignment.startDate);
  const aEnd = safeParseDate(assignment.endDate);
  if (!aStart || !aEnd) return 0;

  const mode = getDistributionMode(assignment);
  const totalHours = getTotalHoursForMode(assignment);

  // MONTHLY MODE: Direct lookup from allocations
  if (mode === 'monthly' && assignment.monthlyAllocations?.length) {
    const monthKey = format(monthStart, 'yyyy-MM');
    const allocations = assignment.monthlyAllocations;
    const allocation = allocations.find((a) => a.month === monthKey);
    return allocation?.hours ?? 0;
  }

  // EVEN MODE: Day-proportional (L6 fix) — distribute hours based on calendar days in the month overlap
  if (mode === 'even') {
    const totalDays = Math.max(1, differenceInCalendarDays(aEnd, aStart) + 1);
    const overlapStart = max([aStart, monthStart]);
    const overlapEnd = min([aEnd, monthEnd]);
    if (overlapStart > overlapEnd) return 0;
    const overlapDays = differenceInCalendarDays(overlapEnd, overlapStart) + 1;
    return totalHours * (overlapDays / totalDays);
  }

  // PHASE MODE: Calculate overlap with phases
  const validPhases = getValidPhases(assignment.phases);
  const totalPhaseHours = validPhases.reduce((sum, p) => sum + (p.hours || 0), 0);

  if (totalPhaseHours === 0) {
    const totalMonths = Math.max(1, differenceInMonths(aEnd, aStart) + 1);
    return totalHours / totalMonths;
  }

  let monthHours = 0;

  validPhases.forEach((phase) => {
    const phaseStart = safeParseDate(phase.startDate);
    const phaseEnd = safeParseDate(phase.endDate);
    if (!phaseStart || !phaseEnd) return;

    const overlapStart = max([phaseStart, monthStart]);
    const overlapEnd = min([phaseEnd, monthEnd]);

    if (overlapStart <= overlapEnd) {
      const phaseDurationMs = phaseEnd.getTime() - phaseStart.getTime();
      const overlapDurationMs = overlapEnd.getTime() - overlapStart.getTime();
      const overlapProportion = phaseDurationMs > 0 ? overlapDurationMs / phaseDurationMs : 0;
      monthHours += (phase.hours || 0) * overlapProportion;
    }
  });

  return monthHours;
};

/**
 * Calculate phase-based revenue for a specific month.
 */
const calculatePhaseRevenueForMonth = (
  assignment: PortfolioAssignment,
  monthStart: Date,
  monthEnd: Date,
  totalGrossRevenue: number
): number => {
  const aStart = safeParseDate(assignment.startDate);
  const aEnd = safeParseDate(assignment.endDate);
  if (!aStart || !aEnd) return 0;

  const mode = getDistributionMode(assignment);
  const totalHours = getTotalHoursForMode(assignment);

  // MONTHLY MODE: Direct lookup with proportional revenue
  if (mode === 'monthly' && assignment.monthlyAllocations?.length) {
    const monthKey = format(monthStart, 'yyyy-MM');
    const allocations = assignment.monthlyAllocations;
    const allocation = allocations.find((a) => a.month === monthKey);
    const monthHours = allocation?.hours ?? 0;

    if (totalHours === 0) return 0;
    return (monthHours / totalHours) * totalGrossRevenue;
  }

  // EVEN MODE: Day-proportional (L6 + Fas 3.1 L2-A: fastpris also proportional)
  if (mode === 'even') {
    const totalDays = Math.max(1, differenceInCalendarDays(aEnd, aStart) + 1);
    const overlapStart = max([aStart, monthStart]);
    const overlapEnd = min([aEnd, monthEnd]);
    if (overlapStart > overlapEnd) return 0;
    const overlapDays = differenceInCalendarDays(overlapEnd, overlapStart) + 1;
    return totalGrossRevenue * (overlapDays / totalDays);
  }

  // PHASE MODE: Calculate based on phase overlap
  const validPhases = getValidPhases(assignment.phases);
  const totalPhaseHours = validPhases.reduce((sum, p) => sum + (p.hours || 0), 0);

  if (totalPhaseHours === 0) {
    const totalMonths = Math.max(1, differenceInMonths(aEnd, aStart) + 1);
    return totalGrossRevenue / totalMonths;
  }

  const revenuePerHour = totalGrossRevenue / totalPhaseHours;
  const monthHours = calculateWorkedHoursForMonth(assignment, monthStart, monthEnd);

  return monthHours * revenuePerHour;
};

/**
 * Get assignment-specific effective settings (handles custom overrides).
 */
export const getAssignmentEffectiveSettings = (
  assignment: PortfolioAssignment,
  globalSettings: AppSettings
): Pick<
  AppSettings,
  | 'brokerCommissionRate'
  | 'brokerMonthlyFee'
  | 'monthlySalaryGross'
  | 'employerTaxRate'
  | 'monthlyOverhead'
> => {
  if (assignment.useCustomSettings && assignment.overrides) {
    return {
      brokerCommissionRate:
        assignment.overrides.brokerCommissionRate ?? globalSettings.brokerCommissionRate,
      brokerMonthlyFee:
        assignment.overrides.brokerMonthlyFee ?? globalSettings.brokerMonthlyFee,
      monthlySalaryGross:
        assignment.overrides.monthlySalaryGross ?? globalSettings.monthlySalaryGross,
      employerTaxRate:
        assignment.overrides.employerTaxRate ?? globalSettings.employerTaxRate,
      monthlyOverhead:
        assignment.overrides.monthlyOverhead ?? globalSettings.monthlyOverhead,
    };
  }
  return {
    brokerCommissionRate: globalSettings.brokerCommissionRate,
    brokerMonthlyFee: globalSettings.brokerMonthlyFee,
    monthlySalaryGross: globalSettings.monthlySalaryGross,
    employerTaxRate: globalSettings.employerTaxRate,
    monthlyOverhead: globalSettings.monthlyOverhead,
  };
};

/**
 * Calculate complete monthly forecast data with revenue lag.
 * This is the main function for the MonthlyForecast component.
 *
 * Fas 3.5: The range extends at least `forecastYears` years from today (or from the earliest
 * assignment start, whichever is earlier) to give a consistent multi-year horizon.
 */
export const calculateMonthlyForecast = (input: MonthlyForecastInput): MonthlyData[] => {
  const { settings } = input;
  const validAssignments = getValidAssignments(input.assignments);

  if (validAssignments.length === 0) {
    return [];
  }

  // Determine month range from all assignment dates
  const allDates = validAssignments
    .flatMap((a) => [safeParseDate(a.startDate), safeParseDate(a.endDate)])
    .filter((d): d is Date => d !== null);

  if (allDates.length === 0) {
    return [];
  }

  const today = new Date();
  const earliestAssignment = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const latestAssignment = new Date(Math.max(...allDates.map((d) => d.getTime())));

  // Start from earlier of: today (start of this month) or earliest assignment
  const minDate = earliestAssignment < today ? earliestAssignment : today;

  // Max lag in months for revenue
  const maxLag = Math.max(
    settings.defaultRevenueLagMonths,
    ...validAssignments.map((a) => a.revenueLagMonths ?? settings.defaultRevenueLagMonths)
  );

  // Fas 3.5: extend to at least forecastYears from today OR beyond latest assignment + lag
  const horizonFromToday = addMonths(today, (settings.forecastYears ?? 3) * 12);
  const horizonFromAssignments = addMonths(latestAssignment, maxLag);
  const maxDate =
    horizonFromToday > horizonFromAssignments ? horizonFromToday : horizonFromAssignments;

  const monthRange = eachMonthOfInterval({
    start: startOfMonth(minDate),
    end: endOfMonth(maxDate),
  });

  // Step 1: Calculate worked hours and revenue value per month for each assignment
  const workedDataByMonth: Map<
    string,
    { hours: number; revenueValue: number; assignments: string[] }
  > = new Map();
  const laggedRevenueByMonth: Map<
    string,
    { total: number; sourceMonths: Set<string> }
  > = new Map();

  // Initialize all months
  monthRange.forEach((monthDate) => {
    const key = format(monthDate, 'yyyy-MM');
    workedDataByMonth.set(key, { hours: 0, revenueValue: 0, assignments: [] });
    laggedRevenueByMonth.set(key, { total: 0, sourceMonths: new Set() });
  });

  // Step 2: For each assignment, calculate worked hours per month and apply lag
  validAssignments.forEach((assignment) => {
    const aStart = safeParseDate(assignment.startDate);
    const aEnd = safeParseDate(assignment.endDate);
    if (!aStart || !aEnd) return;

    const lagMonths = assignment.revenueLagMonths ?? settings.defaultRevenueLagMonths;
    const effectiveSettings = getAssignmentEffectiveSettings(assignment, settings);
    const totalGrossRevenue = calculateAssignmentRevenue(assignment, settings);

    // Fastprisdelen faktureras i klump när uppdraget är klart: den läggs i
    // månaden efter slutmånaden (eller senare om uppdraget har längre
    // fördröjning). Timdelen faktureras löpande med vanlig fördröjning.
    // Det arbetade värdet (workedRevenueValue) sprids fortfarande över tiden.
    const fixedPart =
      assignment.contractType === 'fastpris' ||
      assignment.contractType === 'fastpris_overtid' ||
      assignment.contractType === 'blandat'
        ? Math.min(assignment.fixedPrice ?? 0, totalGrossRevenue)
        : 0;
    const hourlyPart = totalGrossRevenue - fixedPart;
    if (fixedPart > 0) {
      const endMonthKey = format(aEnd, 'yyyy-MM');
      const endIdx = monthRange.findIndex((m) => format(m, 'yyyy-MM') === endMonthKey);
      const payIdx = endIdx + Math.max(1, lagMonths);
      if (endIdx >= 0 && payIdx < monthRange.length) {
        const payData = laggedRevenueByMonth.get(format(monthRange[payIdx], 'yyyy-MM'))!;
        payData.total += fixedPart * (1 - effectiveSettings.brokerCommissionRate);
        payData.sourceMonths.add(format(aEnd, 'MMM', { locale: sv }));
      }
    }

    monthRange.forEach((monthDate, monthIndex) => {
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthKey = format(monthDate, 'yyyy-MM');
      const monthLabel = format(monthDate, 'MMM', { locale: sv });

      // Check if assignment is active in this month (for worked hours)
      const isActive =
        isWithinInterval(monthStart, { start: aStart, end: aEnd }) ||
        isWithinInterval(monthEnd, { start: aStart, end: aEnd }) ||
        (aStart <= monthStart && aEnd >= monthEnd);

      if (isActive) {
        // Calculate worked hours and revenue value for this month
        const workedHours = calculateWorkedHoursForMonth(assignment, monthStart, monthEnd);
        const monthlyGrossRevenue = calculatePhaseRevenueForMonth(
          assignment,
          monthStart,
          monthEnd,
          totalGrossRevenue
        );
        const netRevenue = monthlyGrossRevenue * (1 - effectiveSettings.brokerCommissionRate);
        // Andel som faktureras löpande (fastprisdelen är redan lagd ovan)
        const netInvoicedRevenue =
          totalGrossRevenue > 0 ? netRevenue * (hourlyPart / totalGrossRevenue) : 0;

        const currentData = workedDataByMonth.get(monthKey)!;
        currentData.hours += workedHours;
        currentData.revenueValue += netRevenue;
        if (!currentData.assignments.includes(assignment.name)) {
          currentData.assignments.push(assignment.name);
        }

        // Apply revenue lag - revenue goes to future month
        const laggedMonthIndex = monthIndex + lagMonths;
        if (laggedMonthIndex < monthRange.length) {
          const laggedMonthKey = format(monthRange[laggedMonthIndex], 'yyyy-MM');
          const laggedData = laggedRevenueByMonth.get(laggedMonthKey)!;
          if (netInvoicedRevenue > 0) {
            laggedData.total += netInvoicedRevenue;
            laggedData.sourceMonths.add(monthLabel);
          }
        }
      }
    });
  });

  // Step 3: Build final monthly data with lagged revenue
  // Lön tas bara ut när arbetet som fakturan gäller var full beläggning.
  // Fakturan kommer med fördröjning (minst en månad), så månad M får lön om
  // månaden M − fördröjning hade full beläggning. Tunna månader (t.ex. en
  // utbildning på några timmar i månaden) ger ingen lön.
  const salaryLag = Math.max(1, settings.defaultRevenueLagMonths ?? 1);
  let cumulative = 0;

  return monthRange.map((monthDate, monthIdx) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const monthKey = format(monthDate, 'yyyy-MM');

    // Find assignments active in this month (for costs)
    const activeAssignments = validAssignments.filter((a) => {
      const aStart = safeParseDate(a.startDate);
      const aEnd = safeParseDate(a.endDate);
      if (!aStart || !aEnd) return false;
      return (
        isWithinInterval(monthStart, { start: aStart, end: aEnd }) ||
        isWithinInterval(monthEnd, { start: aStart, end: aEnd }) ||
        (aStart <= monthStart && aEnd >= monthEnd)
      );
    });

    // Get lagged revenue (from previous months' work)
    const laggedData = laggedRevenueByMonth.get(monthKey);
    const revenue = laggedData?.total ?? 0;
    const sourceMonths = laggedData?.sourceMonths ? Array.from(laggedData.sourceMonths) : [];

    // Get worked data for this month
    const workedData = workedDataByMonth.get(monthKey)!;

    const salaryBasisIdx = monthIdx - salaryLag;
    const canWithdrawSalary =
      salaryBasisIdx >= 0 &&
      isFullyBookedMonth(
        workedDataByMonth.get(format(monthRange[salaryBasisIdx], 'yyyy-MM'))?.hours ?? 0,
        settings
      );
    const costBreakdown = calculateMonthlyCosts(
      settings,
      activeAssignments.length > 0,
      canWithdrawSalary
    );

    const net = revenue - costBreakdown.total;
    cumulative += net;

    return {
      month: monthKey,
      monthLabel: format(monthDate, 'MMM', { locale: sv }),
      revenue: Math.round(revenue),
      costs: Math.round(costBreakdown.total),
      net: Math.round(net),
      cumulative: Math.round(cumulative),
      assignments: workedData.assignments,
      workedHours: Math.round(workedData.hours * 10) / 10,
      workedRevenueValue: Math.round(workedData.revenueValue),
      billedRevenue: Math.round(revenue),
      sourceMonths,
      overheadCost: Math.round(costBreakdown.overheadCost),
      salaryCost: Math.round(costBreakdown.salaryCost),
      canWithdrawSalary,
    };
  });
};

/**
 * Calculate summary statistics from monthly forecast data.
 */
export const calculateForecastSummary = (monthlyData: MonthlyData[]) => {
  const totalRevenue = monthlyData.reduce((sum, m) => sum + m.revenue, 0);
  const totalCosts = monthlyData.reduce((sum, m) => sum + m.costs, 0);
  const totalNet = totalRevenue - totalCosts;
  const profitableMonths = monthlyData.filter((m) => m.net >= 0).length;
  const coveragePercent =
    totalCosts > 0 ? Math.min(100, (totalRevenue / totalCosts) * 100) : 0;

  return {
    totalRevenue,
    totalCosts,
    totalNet,
    profitableMonths,
    totalMonths: monthlyData.length,
    coveragePercent,
  };
};
