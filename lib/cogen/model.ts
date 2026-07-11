export type EvidenceStatus = "provided" | "estimated" | "derived" | "not available" | "not applicable";
export type Confidence = "high" | "medium" | "low";

export type CogenInput = {
  clientName: string;
  siteName: string;
  industry: string;
  state: string;
  annualElectricityMwh: number;
  peakDemandMw: number;
  baseDemandMw: number;
  annualBoilerFuelMmbtu: number;
  averageSteamTph: number;
  minimumSteamTph: number;
  peakSteamTph: number;
  steamPressureBarg: number;
  steamTemperatureC: number;
  condensateReturnPercent: number;
  boilerEfficiencyPercent: number;
  operatingHours: number;
  gridEnergyTariffMyrKwh: number;
  demandChargeMyrKwMonth: number;
  gasPriceMyrMmbtu: number;
  waterTreatmentMyrGJ: number;
  capexMyrPerMw: number;
  fixedOmMyrKwYear: number;
  variableOmMyrMwh: number;
  overhaulReserveMyrMwh: number;
  projectLifeYears: number;
  discountRatePercent: number;
  carbonPriceMyrTonne: number;
  tnbInfrastructureRecoveryMyr: number;
  exportEnabled: boolean;
  exportApproved: boolean;
  incentiveConfirmed: boolean;
  incentiveMyr: number;
  technicalApproved: boolean;
  commercialApproved: boolean;
};

export type InputEvidence = {
  key: keyof CogenInput;
  label: string;
  status: EvidenceStatus;
  source: string;
  confidence: Confidence;
};


export type EvidenceAttachment = {
  id: string;
  linkedInputKey: keyof CogenInput;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  sourceType: "pdf" | "image";
  status: EvidenceStatus;
  confidence: Confidence;
  note: string;
  dataUrl?: string;
};

export type ExtractedInputSuggestion = {
  id: string;
  targetKey: keyof CogenInput;
  label: string;
  value: number;
  unit: string;
  sourceFile: string;
  documentType: "electricity_bill" | "gas_invoice" | "steam_log" | "equipment_data" | "general_evidence";
  confidence: Confidence;
  reason: string;
  excerpt: string;
};
export type Check = {
  gate: "data" | "engineering" | "commercial" | "regulatory" | "review";
  status: "pass" | "warning" | "block";
  message: string;
};

export type HmbStream = {
  no: number;
  medium: string;
  mass: string;
  pressure: string;
  temperature: string;
  energy: string;
  basis: string;
  confidence: Confidence;
};

export type CogenResult = {
  usefulHeatMwBase: number;
  usefulHeatMwAverage: number;
  selectedTechnology: "Gas engine" | "Gas turbine";
  unitCount: number;
  netPowerMw: number;
  grossPowerMw: number;
  annualGenerationMwh: number;
  usefulHeatGJYear: number;
  fuelInputMmbtuYear: number;
  capexMyr: number;
  bauCostMyr: number;
  cogenCostMyr: number;
  annualSavingMyr: number;
  simplePaybackYears: number | null;
  lcoeMyrKwh: number;
  heatCreditNetPowerMyrKwh: number;
  npvMyr: number;
  irrPercent: number | null;
  emissionsSavedTco2e: number;
  eecaEnergyGJ: number;
  eecaStatus: "Applicable" | "Below threshold";
  issueStatus: "Issue ready" | "Draft blocked";
  completeness: number;
  checks: Check[];
  streams: HmbStream[];
};

export const defaultInput: CogenInput = {
  clientName: "Contoso Food Manufacturing Sdn. Bhd.",
  siteName: "Shah Alam Process Plant",
  industry: "Food and beverage",
  state: "Selangor",
  annualElectricityMwh: 42800,
  peakDemandMw: 7.8,
  baseDemandMw: 4.9,
  annualBoilerFuelMmbtu: 184000,
  averageSteamTph: 13.5,
  minimumSteamTph: 9.2,
  peakSteamTph: 21,
  steamPressureBarg: 10,
  steamTemperatureC: 184,
  condensateReturnPercent: 55,
  boilerEfficiencyPercent: 82,
  operatingHours: 7800,
  gridEnergyTariffMyrKwh: 0.43,
  demandChargeMyrKwMonth: 45,
  gasPriceMyrMmbtu: 38,
  waterTreatmentMyrGJ: 1.8,
  capexMyrPerMw: 6200000,
  fixedOmMyrKwYear: 145,
  variableOmMyrMwh: 0.036,
  overhaulReserveMyrMwh: 0.028,
  projectLifeYears: 12,
  discountRatePercent: 9,
  carbonPriceMyrTonne: 0,
  tnbInfrastructureRecoveryMyr: 0,
  exportEnabled: false,
  exportApproved: false,
  incentiveConfirmed: false,
  incentiveMyr: 0,
  technicalApproved: false,
  commercialApproved: false,
};

export const defaultEvidence: InputEvidence[] = [
  { key: "annualElectricityMwh", label: "12-month electricity bills", status: "provided", source: "Customer bills Jan-Dec", confidence: "high" },
  { key: "baseDemandMw", label: "Interval demand data", status: "derived", source: "15-minute meter export", confidence: "high" },
  { key: "annualBoilerFuelMmbtu", label: "Boiler fuel invoices", status: "provided", source: "Gas invoices Jan-Dec", confidence: "high" },
  { key: "minimumSteamTph", label: "Minimum coincident steam", status: "estimated", source: "Production shift log", confidence: "medium" },
  { key: "capexMyrPerMw", label: "Budget CAPEX basis", status: "estimated", source: "Generic Raz budget library", confidence: "medium" },
  { key: "gasPriceMyrMmbtu", label: "Gas contract price", status: "provided", source: "Customer supply contract", confidence: "high" },
  { key: "gridEnergyTariffMyrKwh", label: "Grid tariff", status: "provided", source: "Utility bill schedule", confidence: "high" },
];
