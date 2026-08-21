import { ContractType } from './project';

export interface SavedCalculation {
  id: string;
  name: string;
  projectId?: string; // Optional link to a project
  projectName?: string;
  contractType: ContractType;
  fixedPrice: number;
  hours: number;
  hourlyRate: number;
  actualHours?: number;
  startDate: string;
  endDate: string;
  // Calculated results at save time
  grossRevenue: number;
  netRevenue: number;
  netProfit: number;
  profitMargin: number;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}
