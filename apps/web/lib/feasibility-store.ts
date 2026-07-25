import { create } from "zustand";

export type FeasibilityResult = {
  address: string;
  municipality: string;
  zoneCode: string;
  sizeSqm: number;
  price: number;
  unitType: "bachelor" | "1bed" | "2bed" | "luxury";
  targetUnits: number;
  tariffYear: number;
  decisionStatus: "definitive" | "degraded";
  zoningEvidenceAvailable: boolean;
  viable: boolean;
  score: number;
  actualUnits: number;
  maxUnitsAllowed: number | null;
  rezoningRequired: boolean;
  maxFootprintSqm: number | null;
  maxBuildableSqm: number | null;
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

export type FeasibilityInput = {
  address: string;
  municipality: "johannesburg" | "tshwane" | "ekurhuleni";
  zone_code: string;
  size_sqm: number;
  price: number;
  unit_type: "bachelor" | "1bed" | "2bed" | "luxury";
  target_units: number;
  tariff_year: number;
};

type FeasibilityStore = {
  result: FeasibilityResult | null;
  formValues: FeasibilityInput | null;
  setResult: (r: FeasibilityResult, formValues: FeasibilityInput) => void;
  clear: () => void;
};

export const useFeasibilityStore = create<FeasibilityStore>((set) => ({
  result: null,
  formValues: null,
  setResult: (result, formValues) => set({ result, formValues }),
  clear: () => set({ result: null, formValues: null }),
}));
