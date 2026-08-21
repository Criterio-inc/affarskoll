// Swedish tax and business cost calculation utilities
// Handles employer costs, net salary, 3:12 dividend rules, and jobbskatteavdrag estimates.

// ============================================================================
// TYPES
// ============================================================================

export interface TaxCalculation {
  grossSalary: number;
  employerTax: number;
  totalSalaryCost: number;
  municipalTax: number;
  stateTax: number;            // L4: statlig inkomstskatt
  jobbskatteavdrag: number;
  netSalary: number;
}

export interface CompanyCosts {
  salaryCost: number;
  fixedCosts: number;
  brokerFee: number;
  totalMonthlyCost: number;
  totalAnnualCost: number;
}

export interface PricingCalculation {
  minimumHourlyRate: number;
  recommendedHourlyRate: number;
  customerRateViaBroker: number;
  effectiveHourlyRate: number;
}

export interface DividendCalculation {
  dividendAmount: number;
  dividendTax: number;
  netDividend: number;
  isWithinLimit: boolean;
  excessAmount: number;
  excessTax: number;
}

export interface OptimalMix {
  salary: number;
  dividend: number;
  totalNetIncome: number;
  totalTaxPaid: number;
  taxEfficiency: number;
}

export interface CostAllocation {
  fixedCosts: {
    grossSalary: number;
    employerTax: number;
    totalSalaryCost: number;
    brokerOverhead: number;
    totalFixed: number;
  };
  variableCosts: {
    projectExpenses: number;
    brokerCommissionAmount: number;
    totalVariable: number;
  };
  totalMonthlyCost: number;
  utilizationRate: number;
  costPerHour: number;
  isFullCapacity: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Full-time monthly hours (standard) */
export const FULL_TIME_HOURS_PER_MONTH = 160;

/** 20% capital gains tax on dividends within the 3:12 gransbelopp */
export const DIVIDEND_TAX_WITHIN_LIMIT = 0.20;

/** 30% capital gains tax on dividends above the 3:12 gransbelopp */
export const DIVIDEND_TAX_ABOVE_LIMIT = 0.30;

/** Swedish corporate tax rate (bolagsskatt) */
export const CORPORATE_TAX_RATE = 0.206;

/** Full project expense at 100% capacity */
export const BASE_PROJECT_EXPENSES = 5000;

// ============================================================================
// JOBBSKATTEAVDRAG (employment tax credit) ESTIMATE
// ============================================================================

/**
 * Estimate the monthly jobbskatteavdrag (employment tax credit).
 *
 * This is a simplified model based on 2025/2026 Swedish tax rules.
 * The real calculation depends on PBB (prisbasbelopp), age, and income brackets.
 * For typical consultant salaries in the 40-70k SEK/month range this gives
 * a reasonable approximation. The credit phases out at higher incomes.
 *
 * The annual credit for income between ~0.91 PBB and ~3.24 PBB is roughly:
 *   0.3287 * (income - 0.91*PBB) + 0.3287 * 0.91*PBB * 0.116
 * but for simplicity we use a lookup-style estimate.
 *
 * @param annualGross - Annual gross salary in SEK
 * @param municipalTaxRate - Decimal municipal tax rate (e.g. 0.3287)
 * @returns Estimated annual jobbskatteavdrag in SEK
 */
export const estimateJobbskatteavdrag = (
  annualGross: number,
  municipalTaxRate: number
): number => {
  if (annualGross <= 0) return 0;

  // PBB 2026 estimate (prisbasbelopp)
  const PBB = 58800;

  // Bracket boundaries
  const b1 = 0.91 * PBB;   // ~53 508
  const b2 = 3.24 * PBB;   // ~190 512
  const b3 = 8.08 * PBB;   // ~475 104
  const b4 = 13.54 * PBB;  // ~796 152

  let credit = 0;

  if (annualGross <= b1) {
    // Below grundavdrag threshold - minimal credit
    credit = annualGross * municipalTaxRate * 0.116;
  } else if (annualGross <= b2) {
    // Main bracket - most consultants fall here or above
    credit = (annualGross - b1) * (municipalTaxRate + 0.016) + b1 * municipalTaxRate * 0.116;
  } else if (annualGross <= b3) {
    // Flat zone - credit stays roughly constant
    credit = (b2 - b1) * (municipalTaxRate + 0.016) + b1 * municipalTaxRate * 0.116;
  } else if (annualGross <= b4) {
    // Phase-out zone
    const maxCredit = (b2 - b1) * (municipalTaxRate + 0.016) + b1 * municipalTaxRate * 0.116;
    const phaseOut = (annualGross - b3) * 0.03;
    credit = Math.max(0, maxCredit - phaseOut);
  } else {
    // Above phase-out: further reduction
    const maxCredit = (b2 - b1) * (municipalTaxRate + 0.016) + b1 * municipalTaxRate * 0.116;
    const phaseOut = (b4 - b3) * 0.03 + (annualGross - b4) * 0.05;
    credit = Math.max(0, maxCredit - phaseOut);
  }

  return Math.round(credit);
};

// ============================================================================
// CORE TAX CALCULATIONS
// ============================================================================

/**
 * Calculate employer cost (bruttoloen + arbetsgivaravgift)
 */
export const calculateEmployerCost = (
  grossSalary: number,
  employerTaxRate: number
): { employerTax: number; totalCost: number } => {
  const employerTax = grossSalary * employerTaxRate;
  return {
    employerTax,
    totalCost: grossSalary + employerTax,
  };
};

/**
 * Calculate net salary after municipal tax (simplified, without jobbskatteavdrag).
 * For a more accurate estimate including jobbskatteavdrag, use calculateFullTaxBreakdown.
 */
export const calculateNetSalary = (
  grossSalary: number,
  municipalTaxRate: number
): { municipalTax: number; netSalary: number } => {
  const municipalTax = grossSalary * municipalTaxRate;
  return {
    municipalTax,
    netSalary: grossSalary - municipalTax,
  };
};

/**
 * Calculate monthly state income tax (statlig inkomstskatt).
 * L4 FIX: Previously not calculated. Applies only to the portion of annual salary
 * above stateTaxThreshold (brytpunkt), at stateTaxRate.
 *
 * 2026 brytpunkt ~614 000 kr/year, rate 20%.
 *
 * @param annualGross - Annual gross salary in SEK
 * @param threshold - Annual brytpunkt in SEK
 * @param rate - Decimal rate (e.g. 0.20 for 20%)
 * @returns Monthly state tax in SEK
 */
export const calculateStateTaxMonthly = (
  annualGross: number,
  threshold: number,
  rate: number
): number => {
  if (annualGross <= threshold) return 0;
  const taxableAmount = annualGross - threshold;
  return Math.round((taxableAmount * rate) / 12);
};

/**
 * Full tax breakdown for a monthly salary including jobbskatteavdrag + statlig skatt.
 * The jobbskatteavdrag and state tax are distributed evenly across 12 months.
 */
export const calculateFullTaxBreakdown = (
  monthlyGrossSalary: number,
  employerTaxRate: number,
  municipalTaxRate: number,
  stateTaxThreshold: number = 614000,
  stateTaxRate: number = 0.20
): TaxCalculation => {
  const { employerTax, totalCost } = calculateEmployerCost(monthlyGrossSalary, employerTaxRate);
  const { municipalTax } = calculateNetSalary(monthlyGrossSalary, municipalTaxRate);

  const annualGross = monthlyGrossSalary * 12;
  const annualJSA = estimateJobbskatteavdrag(annualGross, municipalTaxRate);
  const monthlyJSA = Math.round(annualJSA / 12);

  const stateTax = calculateStateTaxMonthly(annualGross, stateTaxThreshold, stateTaxRate);

  // Net salary = gross - municipal tax - state tax + jobbskatteavdrag
  const netSalary = monthlyGrossSalary - municipalTax - stateTax + monthlyJSA;

  return {
    grossSalary: monthlyGrossSalary,
    employerTax,
    totalSalaryCost: totalCost,
    municipalTax,
    stateTax,
    jobbskatteavdrag: monthlyJSA,
    netSalary,
  };
};

// ============================================================================
// COMPANY COSTS
// ============================================================================

/**
 * Calculate total company costs per month
 */
export const calculateCompanyCosts = (
  monthlyGrossSalary: number,
  employerTaxRate: number,
  fixedMonthlyCosts: number,
  brokerMonthlyFee: number
): CompanyCosts => {
  const { totalCost: salaryCost } = calculateEmployerCost(monthlyGrossSalary, employerTaxRate);
  const totalMonthlyCost = salaryCost + fixedMonthlyCosts + brokerMonthlyFee;

  return {
    salaryCost,
    fixedCosts: fixedMonthlyCosts,
    brokerFee: brokerMonthlyFee,
    totalMonthlyCost,
    totalAnnualCost: totalMonthlyCost * 12,
  };
};

// ============================================================================
// PRICING
// ============================================================================

/**
 * Calculate required hourly rate for profitability
 */
export const calculateRequiredHourlyRate = (
  annualCosts: number,
  billableHoursPerYear: number,
  brokerCommissionRate: number,
  safetyMargin: number = 0.15
): PricingCalculation => {
  if (billableHoursPerYear <= 0) {
    return {
      minimumHourlyRate: 0,
      recommendedHourlyRate: 0,
      customerRateViaBroker: 0,
      effectiveHourlyRate: 0,
    };
  }

  // Minimum rate to cover costs (break-even), accounting for commission
  const minimumHourlyRate = annualCosts / billableHoursPerYear / (1 - brokerCommissionRate);

  // Recommended rate with safety margin
  const recommendedHourlyRate = minimumHourlyRate * (1 + safetyMargin);

  // Customer rate when working through a broker (what customer pays)
  const customerRateViaBroker = recommendedHourlyRate;

  // Effective rate after broker commission
  const effectiveHourlyRate = recommendedHourlyRate * (1 - brokerCommissionRate);

  return {
    minimumHourlyRate: Math.round(minimumHourlyRate),
    recommendedHourlyRate: Math.round(recommendedHourlyRate),
    customerRateViaBroker: Math.round(customerRateViaBroker),
    effectiveHourlyRate: Math.round(effectiveHourlyRate),
  };
};

// ============================================================================
// DIVIDEND / 3:12 RULES
// ============================================================================

/**
 * Calculate dividend tax according to 3:12 rules.
 * Uses a configurable limit (gransbelopp) instead of a hardcoded constant.
 * This fixes issue P7 - the limit is now sourced from AppSettings.dividendLimit.
 *
 * @param dividendAmount - Total dividend to distribute
 * @param limit - 3:12 gransbelopp (from settings.dividendLimit)
 */
export const calculateDividendTax = (
  dividendAmount: number,
  limit: number
): DividendCalculation => {
  if (dividendAmount <= 0) {
    return {
      dividendAmount: 0,
      dividendTax: 0,
      netDividend: 0,
      isWithinLimit: true,
      excessAmount: 0,
      excessTax: 0,
    };
  }

  const isWithinLimit = dividendAmount <= limit;

  if (isWithinLimit) {
    const dividendTax = dividendAmount * DIVIDEND_TAX_WITHIN_LIMIT;
    return {
      dividendAmount,
      dividendTax,
      netDividend: dividendAmount - dividendTax,
      isWithinLimit: true,
      excessAmount: 0,
      excessTax: 0,
    };
  }

  // Split: portion within limit taxed at 20%, excess taxed at 30%
  const withinLimitTax = limit * DIVIDEND_TAX_WITHIN_LIMIT;
  const excessAmount = dividendAmount - limit;
  const excessTax = excessAmount * DIVIDEND_TAX_ABOVE_LIMIT;
  const totalTax = withinLimitTax + excessTax;

  return {
    dividendAmount,
    dividendTax: totalTax,
    netDividend: dividendAmount - totalTax,
    isWithinLimit: false,
    excessAmount,
    excessTax,
  };
};

/**
 * Calculate optimal salary/dividend mix for tax efficiency.
 * Now includes state tax (statlig inkomstskatt) on high salaries (L4 fix).
 *
 * @param companyProfit - Total company revenue minus external costs
 * @param currentAnnualSalary - Annual gross salary already drawn
 * @param employerTaxRate - Employer tax rate (decimal)
 * @param municipalTaxRate - Municipal tax rate (decimal)
 * @param limit - 3:12 gransbelopp (from settings.dividendLimit)
 * @param stateTaxThreshold - Brytpunkt for statlig skatt (default 614000)
 * @param stateTaxRate - State tax rate (default 0.20)
 */
export const calculateOptimalSalaryDividendMix = (
  companyProfit: number,
  currentAnnualSalary: number,
  employerTaxRate: number,
  municipalTaxRate: number,
  limit: number,
  stateTaxThreshold: number = 614000,
  stateTaxRate: number = 0.20
): OptimalMix => {
  // Total cost of salary (gross + employer tax)
  const salaryTaxCost = calculateEmployerCost(currentAnnualSalary, employerTaxRate);
  const netSalary = calculateNetSalary(currentAnnualSalary, municipalTaxRate);

  // State tax on salary above brytpunkt
  const stateTaxAnnual =
    calculateStateTaxMonthly(currentAnnualSalary, stateTaxThreshold, stateTaxRate) * 12;

  // Remaining profit after salary cost
  const remainingProfit = companyProfit - salaryTaxCost.totalCost;

  // Corporate tax on remaining profit
  const corporateTax = Math.max(0, remainingProfit) * CORPORATE_TAX_RATE;
  const profitAfterCorporateTax = remainingProfit - corporateTax;

  // Available for dividend (limited by 3:12 gransbelopp)
  const maxDividend = Math.max(0, Math.min(profitAfterCorporateTax, limit));
  const dividendCalc = calculateDividendTax(maxDividend, limit);

  const totalNetIncome = netSalary.netSalary - stateTaxAnnual + dividendCalc.netDividend;
  const totalTaxPaid =
    salaryTaxCost.employerTax +
    netSalary.municipalTax +
    stateTaxAnnual +
    corporateTax +
    dividendCalc.dividendTax;

  const totalGross = currentAnnualSalary + maxDividend;
  const taxEfficiency = totalGross > 0 ? (totalNetIncome / totalGross) * 100 : 0;

  return {
    salary: currentAnnualSalary,
    dividend: maxDividend,
    totalNetIncome,
    totalTaxPaid,
    taxEfficiency,
  };
};

// ============================================================================
// BREAK-EVEN
// ============================================================================

/**
 * Calculate break-even point in billable hours
 */
export const calculateBreakEven = (
  fixedCostsPerYear: number,
  hourlyRate: number,
  brokerCommissionRate: number
): { hoursPerYear: number; hoursPerMonth: number; hoursPerWeek: number } => {
  const netRatePerHour = hourlyRate * (1 - brokerCommissionRate);
  if (netRatePerHour <= 0) {
    return { hoursPerYear: Infinity, hoursPerMonth: Infinity, hoursPerWeek: Infinity };
  }
  const hoursPerYear = Math.ceil(fixedCostsPerYear / netRatePerHour);

  return {
    hoursPerYear,
    hoursPerMonth: Math.ceil(hoursPerYear / 12),
    hoursPerWeek: Math.ceil(hoursPerYear / 48), // ~48 working weeks per year
  };
};

// ============================================================================
// ANNUAL PROJECTIONS
// ============================================================================

/**
 * Calculate annual business projections
 */
export const calculateAnnualProjections = (
  monthlyRevenue: number,
  companyCosts: CompanyCosts,
  months: number = 12
) => {
  const totalRevenue = monthlyRevenue * months;
  const totalCosts = companyCosts.totalMonthlyCost * months;
  const grossProfit = totalRevenue - totalCosts;
  const corporateTax = Math.max(0, grossProfit) * CORPORATE_TAX_RATE;
  const netProfit = grossProfit - corporateTax;

  return {
    totalRevenue,
    totalCosts,
    grossProfit,
    corporateTax,
    netProfit,
    profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
  };
};

// ============================================================================
// PROPORTIONAL COST ALLOCATION
// ============================================================================

/**
 * Calculate proportional cost allocation based on capacity utilization.
 * Fixed costs remain constant, variable costs scale with hours worked.
 */
export const calculateProportionalCosts = (
  hoursPerMonth: number,
  monthlyGrossRevenue: number,
  monthlySalaryGross: number,
  employerTaxRate: number,
  brokerOverhead: number,
  baseProjectExpenses: number,
  brokerCommissionRate: number
): CostAllocation => {
  const employerTax = monthlySalaryGross * employerTaxRate;
  const totalSalaryCost = monthlySalaryGross + employerTax;
  const fixedCosts = {
    grossSalary: monthlySalaryGross,
    employerTax,
    totalSalaryCost,
    brokerOverhead,
    totalFixed: totalSalaryCost + brokerOverhead,
  };

  const utilizationRate = Math.min(hoursPerMonth / FULL_TIME_HOURS_PER_MONTH, 1);
  const projectExpenses = baseProjectExpenses * utilizationRate;
  const brokerCommissionAmount = monthlyGrossRevenue * brokerCommissionRate;
  const variableCosts = {
    projectExpenses,
    brokerCommissionAmount,
    totalVariable: projectExpenses + brokerCommissionAmount,
  };

  const totalMonthlyCost = fixedCosts.totalFixed + variableCosts.totalVariable;
  const costPerHour = hoursPerMonth > 0 ? totalMonthlyCost / hoursPerMonth : 0;

  return {
    fixedCosts,
    variableCosts,
    totalMonthlyCost,
    utilizationRate: utilizationRate * 100,
    costPerHour,
    isFullCapacity: utilizationRate >= 1,
  };
};

/**
 * Calculate minimum hourly rate for profitability at a given capacity
 */
export const calculateMinimumHourlyRate = (
  hoursPerMonth: number,
  monthlySalaryGross: number,
  employerTaxRate: number,
  brokerOverhead: number,
  baseProjectExpenses: number,
  brokerCommissionRate: number
): { minimumRate: number; breakEvenRevenue: number } => {
  const employerTax = monthlySalaryGross * employerTaxRate;
  const totalSalaryCost = monthlySalaryGross + employerTax;
  const utilizationRate = Math.min(hoursPerMonth / FULL_TIME_HOURS_PER_MONTH, 1);
  const projectExpenses = baseProjectExpenses * utilizationRate;

  const fixedMonthlyCosts = totalSalaryCost + brokerOverhead + projectExpenses;

  // Revenue needed = fixed costs / (1 - commission rate)
  const breakEvenRevenue = fixedMonthlyCosts / (1 - brokerCommissionRate);
  const minimumRate = hoursPerMonth > 0 ? breakEvenRevenue / hoursPerMonth : 0;

  return {
    minimumRate: Math.ceil(minimumRate),
    breakEvenRevenue: Math.ceil(breakEvenRevenue),
  };
};
