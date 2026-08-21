export type ContractType = 'fastpris' | 'timpris' | 'blandat' | 'fastpris_overtid';
export type ProjectStatus = 'prospekt' | 'aktiv' | 'avslutad' | 'arkiverad';
export type PipelineStatus = 'förfrågan' | 'förhandling' | 'vunnen' | 'förlorad';
export type WorkCategory = 'planering' | 'lopande' | 'dokumentation' | 'mote' | 'resa' | 'analys' | 'utbildning_forelasning' | 'ej_debiterbar' | 'ovrigt';

// Arbetsställe/tjänsteställe för uppdraget (SKV-bedömning per uppdrag)
export type WorkplaceType = 'distans' | 'blandat' | 'pa_plats';
// Var arbetet utfördes en enskild dag
export type WorkLocation = 'hemma' | 'hos_kund' | 'annan';

export interface WorkPackage {
  id: string;
  name: string;
  allocatedHours: number;
  usedHours: number;
  startWeek?: number;  // Optional: relative week from project start (1-based)
  endWeek?: number;    // Optional: relative week (inclusive)
}

export interface ContractFile {
  name: string;
  url: string;
  path: string;
  uploadedAt: string;
}

export interface ExtraRevenueItem {
  id: string;
  name: string;
  amount: number;
  month: string;
}

export interface MonthAllocation {
  month: string;
  revenue: number;
  hasSalary: boolean;
  extraItems: ExtraRevenueItem[];
}

export interface ProjectPhase {
  id: string;
  name: string;
  // Direct ISO date storage - no week conversion needed
  startDate: string;                // ISO date, e.g., "2026-02-02"
  endDate: string;                  // ISO date, e.g., "2026-09-30"
  // Legacy week numbers kept for backward compatibility
  startWeek?: number;               // @deprecated - use startDate
  endWeek?: number;                 // @deprecated - use endDate
  hoursPerWeek?: number;  // Occupancy in h/week (e.g., 40 for full-time)
  hours: number;
  allocationPercentage?: number;    // Allocation % (100 = full-time, 50 = half-time). When set, hours are auto-calculated from working days.
  clientHours?: number;   // Client-facing hours for this phase
  description?: string;
}

export interface Project {
  id: string;
  customerId?: string;
  customerName: string;
  title: string;
  startDate: string;
  endDate: string;
  budgetedHours: number;
  contractType: ContractType;
  hourlyRate?: number;
  fixedPrice?: number;
  status: ProjectStatus;
  pipelineStatus: PipelineStatus;
  workPackages: WorkPackage[];
  contractFiles?: ContractFile[];
  plannedHoursPerWeek?: number;
  billingDate?: number; // Day of month for billing reminder
  notes?: string;
  brokerMonthlyFee?: number;
  // True = förmedlingspartnern tar ingen provision på detta uppdrag (avgiften borttagen).
  brokerCommissionExempt?: boolean;
  // Arbetsställe/tjänsteställe-bedömning för uppdraget
  workplaceType?: WorkplaceType;
  workplaceSharePct?: number;   // ~% på plats (för blandat)
  workplaceNote?: string;       // bolagets skriftliga bedömning + avtalshänvisning
  // Phase distribution for portfolio sync
  usePhaseDistribution?: boolean;
  phases?: ProjectPhase[];
  // Fas 4.1: Revenue lag and absence control at project level
  revenueLagMonths?: number;       // Override settings.defaultRevenueLagMonths
  skipAbsenceDeduction?: boolean;  // For part-time/flexible assignments
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  defaultHourlyRate?: number;
  // Fakturauppgifter — används när kunden är köpare på en genererad faktura
  orgNumber?: string | null;
  invoiceStreet?: string | null;
  invoicePostalCode?: string | null;
  invoiceCity?: string | null;
  invoiceCountry?: string | null;
  invoiceReference?: string | null;   // "Er referens"
  deliveryAddress?: string | null;    // flerradig; tom = samma som fakturaadress
  paymentTermsDays?: number | null;
  createdAt: string;
}

export interface CustomerCommunication {
  id: string;
  customerId: string;
  date: string;
  type: 'email' | 'telefon' | 'möte' | 'övrigt';
  summary: string;
  createdAt: string;
}

export interface PlannedHours {
  id: string;
  projectId: string;
  weekStart: string; // ISO date of week start (Monday)
  plannedHours: number;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  projectId: string;
  workPackageId?: string;
  phaseId?: string;  // Reference to a project phase for phase-based tracking
  date: string;
  hours: number;
  category: WorkCategory;
  description: string;
  isBillable?: boolean;
  location?: WorkLocation;
  createdAt: string;
}

export const WORKPLACE_TYPE_LABELS: Record<WorkplaceType, string> = {
  distans: 'Distans (hemmet är tjänsteställe)',
  blandat: 'Blandat (växlande, del på plats)',
  pa_plats: 'På plats hos kund (tjänsteställe hos kunden)',
};

export const WORK_LOCATION_LABELS: Record<WorkLocation, string> = {
  hemma: 'Hemma',
  hos_kund: 'Hos kund',
  annan: 'Annan',
};

export interface MonthlyStats {
  totalHours: number;
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
}

export const WORK_CATEGORY_LABELS: Record<WorkCategory, string> = {
  planering: 'Planering',
  lopande: 'Löpande arbete',
  dokumentation: 'Dokumentation',
  mote: 'Möte',
  resa: 'Resa',
  analys: 'Analys',
  utbildning_forelasning: 'Utbildning/föreläsning',
  ej_debiterbar: 'Ej debiterbar tid',
  ovrigt: 'Övrigt',
};

// Kategorier som ej är debiterbar tid mot kund
export const NON_BILLABLE_CATEGORIES: WorkCategory[] = [
  'ej_debiterbar',
];

// Hjälpfunktion för att avgöra om en kategori är debiterbar
export const isBillableCategory = (category: WorkCategory): boolean => {
  return !NON_BILLABLE_CATEGORIES.includes(category);
};

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  fastpris: 'Fastpris',
  timpris: 'Timpris',
  blandat: 'Fast + Timpris',
  fastpris_overtid: 'Fastpris med övertid',
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  prospekt: 'Prospekt',
  aktiv: 'Aktiv',
  avslutad: 'Avslutad',
  arkiverad: 'Arkiverad',
};

export const PIPELINE_STATUS_LABELS: Record<PipelineStatus, string> = {
  förfrågan: 'Förfrågan',
  förhandling: 'Förhandling',
  vunnen: 'Vunnen',
  förlorad: 'Förlorad',
};

export const COMMUNICATION_TYPE_LABELS: Record<CustomerCommunication['type'], string> = {
  email: 'E-post',
  telefon: 'Telefon',
  möte: 'Möte',
  övrigt: 'Övrigt',
};
