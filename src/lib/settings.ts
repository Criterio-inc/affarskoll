// App settings type definitions and defaults for Swedish consulting
// Pure utility - no localStorage, no side effects. Persistence is handled by the database layer.

export interface AppSettings {
  // Business parameters
  // Förmedlingspartner (mellanhand som tar provision på uppdragen).
  // Tomt namn = du fakturerar kunden direkt utan mellanhand.
  brokerName: string;
  brokerCommissionRate: number;
  brokerMonthlyFee: number;
  monthlyOverhead: number;
  projectExpenses: number;
  monthlySalaryGross: number;

  // Company info
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;

  // Rapportutseende (PDF) — rubrik överst och text i sidfoten
  reportHeaderName: string;
  reportFooter: string;

  // Tax rates
  employerTaxRate: number;
  vatRate: number;
  municipalTaxRate: number;
  municipality: string;
  // Statlig inkomstskatt (L4)
  stateTaxThreshold: number;   // SEK/year brytpunkt (2026 ~614 000)
  stateTaxRate: number;        // Decimal (0.20 = 20%)

  // Annual planning
  targetBillableHoursPerYear: number;
  targetWeeklyHours: number;
  workDaysPerWeek: number;      // For daily target calculation (L9)
  autoDeriveBillableHours: boolean; // If true, derive from weekly × weeks − absence (L1)
  safetyMargin: number;
  fixedMonthlyCosts: number;

  // Invoice settings
  defaultPaymentTerms: number;

  // Fakturauppgifter — avsändarblocket på genererade fakturor
  companyOrgNumber: string;
  companyVatNumber: string;
  companyBankgiro: string;
  companyStreet: string;
  companyPostalCode: string;
  companyCity: string;
  companyCountry: string;
  companyWebsite: string;
  invoiceEmail: string;
  invoicePhone: string;
  approvedForFSkatt: boolean;   // visar "Godkänd för F-skatt" på fakturan
  // Logotyp på genererade fakturor, lagrad som data-URL (PNG med transparens).
  // Tomt = företagsnamnet skrivs i text i stället.
  companyLogoDataUrl: string;

  // Portfolio/Forecast settings
  defaultRevenueLagMonths: number;
  forecastYears: number;        // How many years to project (Fas 3.5)

  // Availability & Absence settings
  vacationWeeks: number;
  vacationMonths: string[];
  vacationMonthThreshold: number; // Min overlap fraction per month to count (Fas 3.3, beslut B)
  publicHolidayHoursPerYear: number;
  internalTimeHoursPerYear: number;
  sickLeaveHoursPerYear: number;
  applyAbsenceDeductions: boolean;

  // Tax optimization
  dividendLimit: number;

  // Resor / milersättning (kr per km). 2,50 kr/km = 25 kr/mil (skattefri nivå 2023+)
  mileageRatePerKm: number;
  // Tjänsteställe (t.ex. "Åsa (hemmet)"). Visas i reseräkningsunderlaget.
  homeBaseLabel: string;

  // Likviditet — ingående kassa för runway-beräkning på dashboard
  cashBuffer: number;

  // Företagsuppgifter (Skatteverket)
  fSkattFromDate: string;             // ISO date — fr.o.m. F-skatt godkänd
  vatRegisteredFromDate: string;      // ISO date — fr.o.m. momsregistrerad
  employerRegisteredFromDate: string; // ISO date — fr.o.m. arbetsgivare
  vatReportingPeriod: 'monthly' | 'quarterly' | 'yearly'; // momsdeklarationens periodicitet
  vatQuarterlyFromYear: number | null; // året man övergick till kvartalsmoms (Q1+Q2 buntas det året)
  vatAccountingMethod: 'cash' | 'invoice'; // bokslutsmetoden / faktureringsmetoden
  fiscalYearStart: string;            // MM-DD format, t.ex. "01-01"
  fiscalYearEnd: string;              // MM-DD format, t.ex. "12-31"
  sniCode: string;                    // SNI-kod, t.ex. "70.200"
  sniName: string;                    // Verksamhetsbeskrivning
}

export const DEFAULT_SETTINGS: AppSettings = {
  brokerName: '',
  brokerCommissionRate: 0,
  brokerMonthlyFee: 0,
  monthlyOverhead: 5000,
  projectExpenses: 0,
  monthlySalaryGross: 50000,
  companyName: 'Mitt Konsultbolag AB',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  reportHeaderName: '',
  reportFooter: '',
  employerTaxRate: 0.3142,
  vatRate: 0.25,
  municipalTaxRate: 0.3208,
  municipality: 'Stockholm',
  stateTaxThreshold: 614000,
  stateTaxRate: 0.20,
  targetBillableHoursPerYear: 1400,
  targetWeeklyHours: 40,
  workDaysPerWeek: 5,
  autoDeriveBillableHours: true,
  safetyMargin: 0.15,
  fixedMonthlyCosts: 0,
  defaultPaymentTerms: 30,
  // Fakturauppgifter — fylls i under Inställningar → Fakturering & Betalning
  companyOrgNumber: '',
  companyVatNumber: '',
  companyBankgiro: '',
  companyStreet: '',
  companyPostalCode: '',
  companyCity: '',
  companyCountry: 'Sverige',
  companyWebsite: '',
  invoiceEmail: '',
  invoicePhone: '',
  approvedForFSkatt: false,
  companyLogoDataUrl: '',
  defaultRevenueLagMonths: 1,
  forecastYears: 3,
  vacationWeeks: 4,
  vacationMonths: ['juni', 'juli', 'augusti'],
  vacationMonthThreshold: 0.5,
  publicHolidayHoursPerYear: 90,
  internalTimeHoursPerYear: 150,
  sickLeaveHoursPerYear: 40,
  applyAbsenceDeductions: true,
  dividendLimit: 204325, // 2026 3:12 gransbelopp
  mileageRatePerKm: 2.5, // 25 kr/mil
  homeBaseLabel: 'Hemmet',
  cashBuffer: 0,
  // Företagsuppgifter (Skatteverket) — fylls i under Inställningar
  fSkattFromDate: '',
  vatRegisteredFromDate: '',
  employerRegisteredFromDate: '',
  vatReportingPeriod: 'yearly',
  vatQuarterlyFromYear: null,
  vatAccountingMethod: 'cash',
  fiscalYearStart: '01-01',
  fiscalYearEnd: '12-31',
  sniCode: '',
  sniName: '',
};

/**
 * Returns a complete AppSettings object with all fields guaranteed to be defined.
 * Fills in DEFAULT_SETTINGS for any missing or undefined fields.
 *
 * This is the PRIMARY way to access settings throughout the app. It handles
 * partial settings from the database, null/undefined from loading states,
 * and legacy settings that may be missing newer fields.
 */
export const getSafeSettings = (settings: Partial<AppSettings> | null | undefined): AppSettings => {
  if (!settings) return { ...DEFAULT_SETTINGS };
  return Object.fromEntries(
    Object.entries(DEFAULT_SETTINGS).map(([key, defaultVal]) => [
      key,
      (settings as Record<string, unknown>)[key] ?? defaultVal,
    ])
  ) as AppSettings;
};

/**
 * Derive target billable hours per year from weekly hours, vacation and absence settings.
 * Formula: (52 − vacationWeeks) × targetWeeklyHours − publicHolidays − internalTime − sickLeave
 *
 * This represents a realistic upper bound on debiterbara timmar given the user's setup.
 */
export const deriveTargetBillableHoursPerYear = (settings: AppSettings): number => {
  const workingWeeks = Math.max(0, 52 - settings.vacationWeeks);
  const rawHours = workingWeeks * settings.targetWeeklyHours;
  const absence =
    settings.publicHolidayHoursPerYear +
    settings.internalTimeHoursPerYear +
    settings.sickLeaveHoursPerYear;
  return Math.max(0, Math.round(rawHours - absence));
};

/**
 * Get the effective target billable hours per year.
 * Uses derived value if autoDeriveBillableHours is true, otherwise the manually set value.
 */
export const getEffectiveBillableHoursPerYear = (settings: AppSettings): number => {
  if (settings.autoDeriveBillableHours) {
    return deriveTargetBillableHoursPerYear(settings);
  }
  return settings.targetBillableHoursPerYear;
};

/**
 * Get effective daily target hours from weekly target and work days per week (L9).
 * Falls back to 5 days if setting is missing or zero.
 */
export const getDailyTargetHours = (settings: AppSettings): number => {
  const days = Math.max(1, settings.workDaysPerWeek || 5);
  return settings.targetWeeklyHours / days;
};
