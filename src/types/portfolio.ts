import { ContractType } from './project';

// Cost overrides that can be set per assignment
export interface AssignmentCostOverrides {
  brokerCommissionRate?: number;    // broker commission (decimal, e.g., 0.06)
  brokerMonthlyFee?: number;        // broker monthly fee
  monthlySalaryGross?: number;      // Gross salary for this assignment
  employerTaxRate?: number;         // Employer tax rate (decimal)
  monthlyOverhead?: number;         // Fixed monthly overhead costs
}

// Monthly hour allocation for irregular workloads
export interface MonthlyHourAllocation {
  month: string;                    // "2026-01" format (YYYY-MM)
  hours: number;                    // Planned hours for this month
  note?: string;                    // Optional comment (e.g., "Sprint 1")
}

// Distribution mode for how hours are spread across the assignment period
export type DistributionMode = 'even' | 'phases' | 'monthly';

// Phase definition for phase-based revenue distribution
export interface AssignmentPhase {
  id: string;                       // UUID
  name: string;                     // e.g., "Fas A", "Uppstart"
  // NEW: Direct ISO date storage - no week conversion needed
  startDate: string;                // ISO date, e.g., "2026-02-02"
  endDate: string;                  // ISO date, e.g., "2026-09-30"
  // LEGACY: Week numbers kept for backward compatibility (will be ignored if dates exist)
  startWeek?: number;               // @deprecated - use startDate
  endWeek?: number;                 // @deprecated - use endDate
  hoursPerWeek?: number;            // Occupancy in h/week (e.g., 40 for full-time, 20 for half-time)
  hours: number;                    // Consultant hours for this phase (auto-calculated if allocationPercentage is set)
  allocationPercentage?: number;    // Allocation % (100 = full-time, 50 = half-time). When set, hours are auto-calculated from working days.
  clientHours?: number;             // Optional: Client hours for this phase
  description?: string;             // Optional description
}

// Helper type for phase distribution summary
export interface PhaseDistributionSummary {
  totalWeeks: number;
  totalHours: number;
  averageHoursPerWeek: number;
  phases: {
    name: string;
    weeks: number;
    hours: number;
    percentage: number;
  }[];
}

export interface PortfolioAssignment {
  id: string;
  name: string;
  customerName?: string;
  startDate: string;
  endDate: string;
  contractType: ContractType;
  fixedPrice?: number;
  hourlyRate?: number;
  hours?: number;
  isFromSystem: boolean;
  projectId?: string;
  // Cost overrides
  useCustomSettings?: boolean;
  overrides?: AssignmentCostOverrides;
  // Distribution mode (replaces usePhaseDistribution for new code)
  distributionMode?: DistributionMode;
  // Phase-based distribution (legacy: usePhaseDistribution boolean still supported)
  usePhaseDistribution?: boolean;   // @deprecated - use distributionMode: 'phases'
  phases?: AssignmentPhase[];       // Array of phases if phase-based
  // Monthly allocation (new)
  monthlyAllocations?: MonthlyHourAllocation[];  // Array of monthly hour allocations
  // Revenue lag (delay between work and payment)
  revenueLagMonths?: number;        // Default: 1, number of months delay between work and revenue
  // Absence deduction control
  skipAbsenceDeduction?: boolean;   // Default: false, set true for part-time/flexible assignments
}

export interface MonthlyData {
  month: string;
  monthLabel: string;
  revenue: number;
  costs: number;
  net: number;
  cumulative: number;
  assignments: string[];
  // Enhanced data for revenue lag tracking
  workedHours?: number;             // Hours worked this month
  billedRevenue?: number;           // Revenue billed this month (from previous months' work)
  workedRevenueValue?: number;      // Value of work done this month (before lag)
  sourceMonths?: string[];          // Months from which the revenue originates (for tooltip display)
  // Separated cost tracking for salary-timing logic
  overheadCost?: number;            // Fixed costs (overhead, broker fee) - tied to active work
  salaryCost?: number;              // Salary + employer tax - only when revenue exists
  canWithdrawSalary?: boolean;      // Whether salary can be taken this month (has revenue)
}
