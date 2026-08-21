// Absence and availability calculations for realistic billable hours.
// Handles vacation, public holidays, internal time, and sick leave deductions
// proportionally based on assignment duration and calendar overlap.

import {
  differenceInDays,
  parseISO,
  isValid,
  getMonth,
  startOfMonth,
  endOfMonth,
  min as minDate,
  max as maxDate,
} from 'date-fns';

// ============================================================================
// TYPES
// ============================================================================

export interface AbsenceSettings {
  vacationWeeks: number;
  vacationMonths: string[];
  /** Min. overlap fraction per month required to count as a vacation month (Fas 3.3).
   *  Range 0-1. 0 = any touch counts (legacy behaviour), 0.5 = at least half of the month. */
  vacationMonthThreshold?: number;
  publicHolidayHoursPerYear: number;
  internalTimeHoursPerYear: number;
  sickLeaveHoursPerYear: number;
  applyAbsenceDeductions: boolean;
}

export interface AbsenceDeduction {
  theoreticalHours: number;
  vacationHours: number;
  publicHolidayHours: number;
  internalTimeHours: number;
  sickLeaveHours: number;
  totalDeduction: number;
  effectiveHours: number;
  yearFraction: number;
  vacationMonthsInRange: string[];
}

// ============================================================================
// SWEDISH MONTH NAMES
// ============================================================================

const MONTH_NAMES_SV: Record<number, string> = {
  0: 'januari',
  1: 'februari',
  2: 'mars',
  3: 'april',
  4: 'maj',
  5: 'juni',
  6: 'juli',
  7: 'augusti',
  8: 'september',
  9: 'oktober',
  10: 'november',
  11: 'december',
};

// ============================================================================
// DATE RANGE HELPERS
// ============================================================================

/**
 * Get all unique months (as Swedish names) that a date range spans.
 */
export const getMonthsInRange = (startDate: string, endDate: string): string[] => {
  try {
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    if (!isValid(start) || !isValid(end)) return [];

    const months: Set<string> = new Set();
    const current = new Date(start);

    while (current <= end) {
      months.add(MONTH_NAMES_SV[getMonth(current)]);
      current.setMonth(current.getMonth() + 1);
    }

    return Array.from(months);
  } catch {
    return [];
  }
};

/**
 * Get months that pass the overlap threshold (Fas 3.3 / L7 beslut B).
 * Returns only months where the assignment covers at least `threshold` fraction of the month.
 */
export const getMonthsInRangeWithThreshold = (
  startDate: string,
  endDate: string,
  threshold: number
): string[] => {
  try {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    if (!isValid(start) || !isValid(end)) return [];

    const months: string[] = [];
    const firstMonth = startOfMonth(start);
    const current = new Date(firstMonth);

    while (current <= end) {
      const monthStart = startOfMonth(current);
      const monthEnd = endOfMonth(current);
      const overlapStart = maxDate([start, monthStart]);
      const overlapEnd = minDate([end, monthEnd]);

      if (overlapStart <= overlapEnd) {
        const monthDays = differenceInDays(monthEnd, monthStart) + 1;
        const overlapDays = differenceInDays(overlapEnd, overlapStart) + 1;
        const fraction = overlapDays / monthDays;
        if (fraction >= threshold) {
          months.push(MONTH_NAMES_SV[getMonth(current)]);
        }
      }

      current.setMonth(current.getMonth() + 1);
    }

    return months;
  } catch {
    return [];
  }
};

/**
 * Calculate the fraction of a year that a date range represents.
 */
export const calculateYearFraction = (startDate: string, endDate: string): number => {
  try {
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    if (!isValid(start) || !isValid(end)) return 0;

    const days = differenceInDays(end, start) + 1;
    return days / 365;
  } catch {
    return 0;
  }
};

// ============================================================================
// ABSENCE DEDUCTIONS
// ============================================================================

/**
 * Calculate absence deductions for an assignment or phase.
 *
 * @param theoreticalHours - Raw hours from weeks x hoursPerWeek
 * @param startDate - ISO date string for period start
 * @param endDate - ISO date string for period end
 * @param settings - Absence settings from user configuration
 * @returns Detailed breakdown of deductions and effective hours
 */
export const calculateAbsenceDeductions = (
  theoreticalHours: number,
  startDate: string,
  endDate: string,
  settings: AbsenceSettings
): AbsenceDeduction => {
  // Safe default response for invalid inputs
  const safeDefault: AbsenceDeduction = {
    theoreticalHours,
    vacationHours: 0,
    publicHolidayHours: 0,
    internalTimeHours: 0,
    sickLeaveHours: 0,
    totalDeduction: 0,
    effectiveHours: theoreticalHours,
    yearFraction: 0,
    vacationMonthsInRange: [],
  };

  if (!startDate || !endDate || !settings) {
    return safeDefault;
  }

  try {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    if (!isValid(start) || !isValid(end)) {
      return safeDefault;
    }
  } catch {
    return safeDefault;
  }

  // If deductions are disabled, return theoretical hours unchanged
  if (!settings.applyAbsenceDeductions) {
    return {
      ...safeDefault,
      yearFraction: calculateYearFraction(startDate, endDate),
    };
  }

  // Fas 3.3: Apply vacation threshold — month counts only if overlap fraction >= threshold
  const threshold = settings.vacationMonthThreshold ?? 0;
  const monthsInRange =
    threshold > 0
      ? getMonthsInRangeWithThreshold(startDate, endDate, threshold)
      : getMonthsInRange(startDate, endDate);
  const yearFraction = calculateYearFraction(startDate, endDate);

  // Vacation: Only deduct if the period covers configured vacation months
  const vacationMonthsInRange = monthsInRange.filter((m) =>
    settings.vacationMonths.map((vm) => vm.toLowerCase()).includes(m.toLowerCase())
  );

  // Calculate vacation hours proportionally.
  // If assignment covers 2 of 3 configured vacation months, deduct 2/3 of total vacation.
  let vacationHours = 0;
  if (vacationMonthsInRange.length > 0 && settings.vacationMonths.length > 0) {
    const vacationFraction = vacationMonthsInRange.length / settings.vacationMonths.length;
    vacationHours = settings.vacationWeeks * 40 * vacationFraction;
  }

  // Proportional deductions based on assignment duration as fraction of year
  const publicHolidayHours = settings.publicHolidayHoursPerYear * yearFraction;
  const internalTimeHours = settings.internalTimeHoursPerYear * yearFraction;
  const sickLeaveHours = settings.sickLeaveHoursPerYear * yearFraction;

  const totalDeduction = vacationHours + publicHolidayHours + internalTimeHours + sickLeaveHours;
  const effectiveHours = Math.max(0, theoreticalHours - totalDeduction);

  return {
    theoreticalHours,
    vacationHours: Math.round(vacationHours),
    publicHolidayHours: Math.round(publicHolidayHours),
    internalTimeHours: Math.round(internalTimeHours),
    sickLeaveHours: Math.round(sickLeaveHours),
    totalDeduction: Math.round(totalDeduction),
    effectiveHours: Math.round(effectiveHours),
    yearFraction,
    vacationMonthsInRange,
  };
};

/**
 * Calculate absence for a specific phase.
 */
export const calculatePhaseAbsence = (
  phase: { startDate: string; endDate: string; hours: number },
  settings: AbsenceSettings
): AbsenceDeduction => {
  return calculateAbsenceDeductions(phase.hours, phase.startDate, phase.endDate, settings);
};

/**
 * Calculate total effective hours for an assignment with multiple phases.
 */
export const calculateAssignmentEffectiveHours = (
  phases: Array<{ startDate: string; endDate: string; hours: number }>,
  assignmentStartDate: string,
  assignmentEndDate: string,
  settings: AbsenceSettings
): {
  theoreticalHours: number;
  effectiveHours: number;
  totalDeduction: number;
  phaseDeductions: AbsenceDeduction[];
} => {
  // Safe default for missing or invalid settings
  if (!settings) {
    const totalHours = phases?.reduce((sum, p) => sum + (p.hours || 0), 0) || 0;
    return {
      theoreticalHours: totalHours,
      effectiveHours: totalHours,
      totalDeduction: 0,
      phaseDeductions: [],
    };
  }

  if (!phases || phases.length === 0) {
    const deduction = calculateAbsenceDeductions(
      0,
      assignmentStartDate,
      assignmentEndDate,
      settings
    );
    return {
      theoreticalHours: 0,
      effectiveHours: 0,
      totalDeduction: 0,
      phaseDeductions: [deduction],
    };
  }

  // Filter out phases with invalid dates
  const validPhases = phases.filter(
    (phase) => phase.startDate && phase.endDate && phase.hours != null
  );

  const phaseDeductions = validPhases.map((phase) => calculatePhaseAbsence(phase, settings));

  const theoreticalHours = phaseDeductions.reduce((sum, d) => sum + d.theoreticalHours, 0);
  const effectiveHours = phaseDeductions.reduce((sum, d) => sum + d.effectiveHours, 0);
  const totalDeduction = phaseDeductions.reduce((sum, d) => sum + d.totalDeduction, 0);

  return {
    theoreticalHours,
    effectiveHours,
    totalDeduction,
    phaseDeductions,
  };
};

/**
 * Format absence deduction for display (Swedish labels).
 */
export const formatAbsenceBreakdown = (deduction: AbsenceDeduction): string => {
  const lines: string[] = [];

  if (deduction.vacationHours > 0) {
    lines.push(`Semester: -${deduction.vacationHours}h`);
  }
  if (deduction.publicHolidayHours > 0) {
    lines.push(`Roda dagar: -${deduction.publicHolidayHours}h`);
  }
  if (deduction.internalTimeHours > 0) {
    lines.push(`Intern tid: -${deduction.internalTimeHours}h`);
  }
  if (deduction.sickLeaveHours > 0) {
    lines.push(`VAB/sjukdom: -${deduction.sickLeaveHours}h`);
  }

  return lines.join('\n');
};
