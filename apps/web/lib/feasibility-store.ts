import { create } from "zustand";

export type FeasibilityResult = {
  address: string;
  municipality: string;
  zoneCode: string;
  sizeSqm: number;
  price: number;
  unitType: string;
  targetUnits: number;
  viable: boolean;
  score: number;
  actualUnits: number;
  maxUnitsAllowed: number;
  rezoningRequired: boolean;
  maxFootprintSqm: number;
  maxBuildableSqm: number;
  costLand: number;
  costBuild: number;
  costProfessionalFees: number;
  costBulkContributions: number;
  costTransferDuty: number;
  costTotal: number;
  rentPerUnitMonthly: number;
  grossMonthlyIncome: number;
  grossAnnualIncome: number;
  yieldGrossPct: number;
  yieldAt85OccPct: number;
  viabilityNotes: string;
  dolomiteRisk: string;
};

type FeasibilityStore = {
  result: FeasibilityResult | null;
  formValues: Partial<FeasibilityResult> | null;
  setResult: (r: FeasibilityResult, formValues: Partial<FeasibilityResult>) => void;
  clear: () => void;
};

export const useFeasibilityStore = create<FeasibilityStore>((set) => ({
  result: null,
  formValues: null,
  setResult: (result, formValues) => set({ result, formValues }),
  clear: () => set({ result: null, formValues: null }),
}));
