import type { Check, CogenInput, CogenResult, HmbStream, InputEvidence } from "./model";

const MMBTU_TO_GJ = 1.055056;
const MWH_TO_GJ = 3.6;
const NATURAL_GAS_LHV_TO_HHV = 0.9;
const SOP_CCPP_HEAT_RATE_BTU_KWH = 6203;
const SOP_CCPP_NET_EFFICIENCY_PERCENT = 55;
const PURPA_EFFICIENCY_THRESHOLD_PERCENT = 42.5;
const HRSG_RADIATION_LOSS_FACTOR = 0.985;
const EXHAUST_CP_KJ_KG_K = 1.1;
const ANNUAL_PERIOD_HOURS = 8760;
const GAS_TCO2_PER_MMBTU = 0.05306;
const GRID_TCO2_PER_MWH = 0.758;
const CALCULATION_VERSION = "0.2.0-sop";

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function annuityFactor(rate: number, years: number) {
  if (rate === 0) return years;
  return (1 - (1 + rate) ** -years) / rate;
}

function estimateIrr(initialInvestment: number, annualCashFlow: number, years: number) {
  if (annualCashFlow <= 0 || initialInvestment <= 0) return null;
  let low = -0.9;
  let high = 1.5;
  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    const npv = -initialInvestment + annualCashFlow * annuityFactor(mid, years);
    if (npv > 0) low = mid;
    else high = mid;
  }
  return round(((low + high) / 2) * 100, 1);
}

function stackValue(total: number, percentValue: number) {
  return round(total * percentValue / 100, 0);
}

function capexStack(totalCapexMyr: number) {
  return [
    { component: "Gas Turbine", percent: 30, valueMyr: stackValue(totalCapexMyr, 30) },
    { component: "Steam Turbine", percent: 10, valueMyr: stackValue(totalCapexMyr, 10) },
    { component: "HRSG", percent: 10, valueMyr: stackValue(totalCapexMyr, 10) },
    { component: "Mechanical Systems", percent: 15, valueMyr: stackValue(totalCapexMyr, 15) },
    { component: "Electrical Systems", percent: 12, valueMyr: stackValue(totalCapexMyr, 12) },
    { component: "Controls", percent: 3, valueMyr: stackValue(totalCapexMyr, 3) },
    { component: "Civil & Infrastructure", percent: 20, valueMyr: stackValue(totalCapexMyr, 20) },
  ];
}

function lccStack(capexMyr: number, annualCogenCostMyr: number, years: number) {
  const totalLifeCycleMyr = capexMyr + annualCogenCostMyr * years;
  return [
    { component: "Fuel Costs", percent: 75, valueMyr: stackValue(totalLifeCycleMyr, 75) },
    { component: "O&M Costs", percent: 17, valueMyr: stackValue(totalLifeCycleMyr, 17) },
    { component: "Initial Capital", percent: 8, valueMyr: stackValue(totalLifeCycleMyr, 8) },
  ];
}

function usefulHeatMw(steamTph: number, condensateReturnPercent: number) {
  const latentKjKg = 2015;
  const sensibleKjKg = 420 * (1 - condensateReturnPercent / 100);
  return (steamTph * 1000 * (latentKjKg + sensibleKjKg)) / 3600000;
}

function buildStreams(input: CogenInput, result: Pick<CogenResult, "fuelInputMmbtuYear" | "grossPowerMw" | "netPowerMw" | "usefulHeatMwAverage" | "annualGenerationMwh" | "usefulHeatGJYear">): HmbStream[] {
  const fuelMmbtuHr = result.fuelInputMmbtuYear / input.operatingHours;
  const steamTph = input.averageSteamTph;
  const condensateTph = steamTph * (input.condensateReturnPercent / 100);
  const makeupTph = steamTph - condensateTph;
  return [
    { no: 1, medium: "Natural gas", mass: `${round(fuelMmbtuHr, 2)} MMBtu/h`, pressure: "Contract basis", temperature: "Ambient", energy: `${round(fuelMmbtuHr * MMBTU_TO_GJ, 2)} GJ/h`, basis: "HHV fuel input", confidence: "medium" },
    { no: 2, medium: "Generator gross power", mass: "-", pressure: "-", temperature: "-", energy: `${round(result.grossPowerMw, 2)} MW`, basis: "Gross electrical boundary", confidence: "medium" },
    { no: 3, medium: "Auxiliaries", mass: "-", pressure: "-", temperature: "-", energy: `${round(result.grossPowerMw - result.netPowerMw, 2)} MW`, basis: "5% auxiliary allowance", confidence: "medium" },
    { no: 4, medium: "Net power to site", mass: "-", pressure: `${input.baseDemandMw} MW base-load cap`, temperature: "-", energy: `${round(result.netPowerMw, 2)} MW`, basis: "Export disabled by default", confidence: "high" },
    { no: 5, medium: "Recovered useful heat", mass: `${round(steamTph, 2)} t/h steam equivalent`, pressure: `${input.steamPressureBarg} bar(g)`, temperature: `${input.steamTemperatureC} C`, energy: `${round(result.usefulHeatMwAverage, 2)} MWth`, basis: "Simplified MVP steam estimate", confidence: "medium" },
    { no: 6, medium: "Condensate return", mass: `${round(condensateTph, 2)} t/h`, pressure: "Process return", temperature: "Estimated", energy: "Credited in useful heat", basis: "Customer return percentage", confidence: "medium" },
    { no: 7, medium: "Make-up water", mass: `${round(makeupTph, 2)} t/h`, pressure: "BOP", temperature: "Ambient", energy: "Water treatment costed", basis: "Water balance", confidence: "medium" },
    { no: 8, medium: "Annual net generation", mass: "-", pressure: "-", temperature: "-", energy: `${round(result.annualGenerationMwh, 0)} MWh/y`, basis: "Operating-hour dispatch", confidence: "high" },
    { no: 9, medium: "Annual useful heat", mass: "-", pressure: "-", temperature: "-", energy: `${round(result.usefulHeatGJYear, 0)} GJ/y`, basis: "Operating-hour dispatch", confidence: "medium" },
  ];
}

export function calculateCogen(input: CogenInput, evidence: InputEvidence[]): CogenResult {
  const checks: Check[] = [];
  const usefulHeatMwBase = usefulHeatMw(input.minimumSteamTph, input.condensateReturnPercent);
  const usefulHeatMwAverage = usefulHeatMw(input.averageSteamTph, input.condensateReturnPercent);
  const usefulHeatEfficiency = 0.43;
  const electricalEfficiency = usefulHeatMwBase < 7 ? 0.39 : 0.32;
  const auxiliaryLoss = 0.05;
  const fuelInputMw = usefulHeatMwBase / usefulHeatEfficiency;
  const rawGrossPowerMw = fuelInputMw * electricalEfficiency;
  const ambientRiseF = Math.max(0, (input.ambientTemperatureC - input.referenceAmbientTemperatureC) * 9 / 5);
  const ambientDeratePercentRaw = Math.min(35, ambientRiseF * 0.5);
  const grossPowerMw = rawGrossPowerMw * (1 - ambientDeratePercentRaw / 100);
  const unconstrainedNetPowerMw = grossPowerMw * (1 - auxiliaryLoss);
  const netPowerMw = input.exportEnabled && input.exportApproved ? unconstrainedNetPowerMw : Math.min(unconstrainedNetPowerMw, input.baseDemandMw);
  const selectedTechnology: "Gas engine" | "Gas turbine" = usefulHeatMwBase < 7 ? "Gas engine" : "Gas turbine";
  const unitSizeMw = selectedTechnology === "Gas engine" ? 2 : 5;
  const unitCount = Math.max(1, Math.ceil(netPowerMw / unitSizeMw));
  const annualGenerationMwh = netPowerMw * input.operatingHours;
  const usefulHeatGJYear = usefulHeatMwAverage * input.operatingHours * MWH_TO_GJ;
  const fuelInputMmbtuYear = annualGenerationMwh / electricalEfficiency * MWH_TO_GJ / MMBTU_TO_GJ;
  const installedCapexMyr = netPowerMw * input.capexMyrPerMw;
  const tnbRecoveryMyr = Math.max(0, input.tnbInfrastructureRecoveryMyr);
  const incentiveMyr = input.incentiveConfirmed ? input.incentiveMyr : 0;
  const capexMyr = installedCapexMyr + tnbRecoveryMyr - incentiveMyr;

  const bauElectricityMyr = input.annualElectricityMwh * 1000 * input.gridEnergyTariffMyrKwh;
  const bauDemandMyr = input.peakDemandMw * 1000 * input.demandChargeMyrKwMonth * 12;
  const bauBoilerFuelMyr = input.annualBoilerFuelMmbtu * input.gasPriceMyrMmbtu;
  const bauCostMyr = bauElectricityMyr + bauDemandMyr + bauBoilerFuelMyr;

  const cogenFuelMyr = fuelInputMmbtuYear * input.gasPriceMyrMmbtu;
  const residualGridMwh = Math.max(0, input.annualElectricityMwh - annualGenerationMwh);
  const residualGridMyr = residualGridMwh * 1000 * input.gridEnergyTariffMyrKwh;
  const residualDemandMyr = Math.max(0, input.peakDemandMw - netPowerMw * 0.65) * 1000 * input.demandChargeMyrKwMonth * 12;
  const supplementalBoilerMmbtu = Math.max(0, input.annualBoilerFuelMmbtu - usefulHeatGJYear / MMBTU_TO_GJ / (input.boilerEfficiencyPercent / 100));
  const supplementalBoilerMyr = supplementalBoilerMmbtu * input.gasPriceMyrMmbtu;
  const waterTreatmentMyr = usefulHeatGJYear * input.waterTreatmentMyrGJ;
  const fixedOmMyr = netPowerMw * 1000 * input.fixedOmMyrKwYear;
  const variableOmMyr = annualGenerationMwh * (input.variableOmMyrMwh + input.overhaulReserveMyrMwh) * 1000;
  const carbonMyr = fuelInputMmbtuYear * GAS_TCO2_PER_MMBTU * input.carbonPriceMyrTonne;
  const cogenCostMyr = cogenFuelMyr + residualGridMyr + residualDemandMyr + supplementalBoilerMyr + waterTreatmentMyr + fixedOmMyr + variableOmMyr + carbonMyr;
  const annualSavingMyr = bauCostMyr - cogenCostMyr;
  const simplePaybackYears = annualSavingMyr > 0 ? capexMyr / annualSavingMyr : null;
  const capitalRecoveryMyr = capexMyr / annuityFactor(input.discountRatePercent / 100, input.projectLifeYears);
  const lcoeMyrKwh = (capitalRecoveryMyr + fixedOmMyr + variableOmMyr + cogenFuelMyr) / (annualGenerationMwh * 1000);
  const heatCreditNetPowerMyrKwh = (capitalRecoveryMyr + fixedOmMyr + variableOmMyr + cogenFuelMyr - Math.min(bauBoilerFuelMyr, supplementalBoilerMyr + usefulHeatGJYear / MMBTU_TO_GJ * input.gasPriceMyrMmbtu)) / (annualGenerationMwh * 1000);
  const npvMyr = -capexMyr + annualSavingMyr * annuityFactor(input.discountRatePercent / 100, input.projectLifeYears);
  const irrPercent = estimateIrr(capexMyr, annualSavingMyr, input.projectLifeYears);
  const emissionsSavedTco2e = input.annualElectricityMwh * GRID_TCO2_PER_MWH + input.annualBoilerFuelMmbtu * GAS_TCO2_PER_MMBTU - fuelInputMmbtuYear * GAS_TCO2_PER_MMBTU - residualGridMwh * GRID_TCO2_PER_MWH - supplementalBoilerMmbtu * GAS_TCO2_PER_MMBTU;
  const eecaEnergyGJ = input.annualElectricityMwh * MWH_TO_GJ + input.annualBoilerFuelMmbtu * MMBTU_TO_GJ;
  const fuelInputLhvGJYear = fuelInputMmbtuYear * MMBTU_TO_GJ * NATURAL_GAS_LHV_TO_HHV;
  const purpaEfficiencyRaw = fuelInputLhvGJYear > 0 ? ((annualGenerationMwh * MWH_TO_GJ + 0.5 * usefulHeatGJYear) / fuelInputLhvGJYear) * 100 : 0;
  const purpaQualified = purpaEfficiencyRaw >= PURPA_EFFICIENCY_THRESHOLD_PERCENT;
  const hrsgSteamKgS = input.steamEnthalpyRiseKjKg > 0 ? input.exhaustMassFlowKgS * EXHAUST_CP_KJ_KG_K * Math.max(0, input.exhaustTemperatureC - input.stackTemperatureC) * HRSG_RADIATION_LOSS_FACTOR / input.steamEnthalpyRiseKjKg : 0;
  const hrsgSteamTph = hrsgSteamKgS * 3.6;
  const availabilityRaw = Math.max(0, Math.min(100, (ANNUAL_PERIOD_HOURS - input.plannedMaintenanceHours - input.forcedOutageHours - input.equivalentForcedOutageHours) / ANNUAL_PERIOD_HOURS * 100));
  const reliabilityRaw = Math.max(0, Math.min(100, (ANNUAL_PERIOD_HOURS - input.forcedOutageHours - input.equivalentForcedOutageHours) / ANNUAL_PERIOD_HOURS * 100));
  const riskScoreMyr = (input.riskProbabilityPercent / 100) * input.riskConsequenceMyr;
  const eecaStatus: "Applicable" | "Below threshold" = eecaEnergyGJ >= 21600 ? "Applicable" : "Below threshold";

  const materialEvidence = evidence.filter((item) => item.status !== "not applicable");
  const completeEvidence = materialEvidence.filter((item) => item.status === "provided" || item.status === "derived").length;
  const completeness = materialEvidence.length === 0 ? 0 : Math.round((completeEvidence / materialEvidence.length) * 100);

  if (input.operatingHours < 4000) checks.push({ gate: "data", status: "block", message: "Operating hours below the configurable lead-qualification rule." });
  if (input.minimumSteamTph <= 0) checks.push({ gate: "engineering", status: "block", message: "Minimum useful heat demand is required for heat-led sizing." });
  if (!input.exportApproved && netPowerMw > input.baseDemandMw) checks.push({ gate: "engineering", status: "block", message: "Selected capacity exceeds electrical base load without export approval." });
  if (input.exportEnabled && !input.exportApproved) checks.push({ gate: "regulatory", status: "block", message: "Export revenue is disabled until regulatory and interconnection approval is recorded." });
  if (input.incentiveMyr > 0 && !input.incentiveConfirmed) checks.push({ gate: "commercial", status: "block", message: "Incentive value cannot be included without project-specific evidence." });
  if (annualSavingMyr < 0) checks.push({ gate: "commercial", status: "warning", message: "The base case has negative savings; the proposal must show this plainly." });
  if (!purpaQualified) checks.push({ gate: "regulatory", status: "block", message: `SOP/PURPA efficiency is ${round(purpaEfficiencyRaw, 1)}%, below the 42.5% qualification threshold.` });
  if (ambientDeratePercentRaw > 0) checks.push({ gate: "engineering", status: "warning", message: `Ambient derate applied: ${round(ambientDeratePercentRaw, 1)}% power output reduction versus ${input.referenceAmbientTemperatureC} C reference.` });
  if (hrsgSteamTph < input.minimumSteamTph) checks.push({ gate: "engineering", status: "warning", message: `SOP HRSG estimate provides ${round(hrsgSteamTph, 1)} t/h steam versus ${input.minimumSteamTph} t/h minimum demand; confirm OEM exhaust data or supplementary firing.` });
  if (availabilityRaw < 92) checks.push({ gate: "engineering", status: "warning", message: `Availability is ${round(availabilityRaw, 1)}%; review planned maintenance and forced outage allowance.` });
  if (completeness < 80) checks.push({ gate: "data", status: "warning", message: "Less than 80% of material inputs have direct evidence or derived trace." });
  if (!input.technicalApproved) checks.push({ gate: "review", status: "block", message: "Technical reviewer approval is required before issue." });
  if (!input.commercialApproved) checks.push({ gate: "review", status: "block", message: "Commercial reviewer approval is required before issue." });
  if (eecaStatus === "Applicable") checks.push({ gate: "regulatory", status: "warning", message: "EECA threshold met; show REM, EnMS, reporting and audit pathway separately from project approvals." });

  const resultBase = {
    usefulHeatMwBase: round(usefulHeatMwBase, 2),
    usefulHeatMwAverage: round(usefulHeatMwAverage, 2),
    selectedTechnology,
    unitCount,
    netPowerMw: round(netPowerMw, 2),
    grossPowerMw: round(grossPowerMw, 2),
    annualGenerationMwh: round(annualGenerationMwh, 0),
    usefulHeatGJYear: round(usefulHeatGJYear, 0),
    fuelInputMmbtuYear: round(fuelInputMmbtuYear, 0),
    capexMyr: round(capexMyr, 0),
    bauCostMyr: round(bauCostMyr, 0),
    cogenCostMyr: round(cogenCostMyr, 0),
    annualSavingMyr: round(annualSavingMyr, 0),
    simplePaybackYears: simplePaybackYears ? round(simplePaybackYears, 1) : null,
    lcoeMyrKwh: round(lcoeMyrKwh, 3),
    heatCreditNetPowerMyrKwh: round(heatCreditNetPowerMyrKwh, 3),
    npvMyr: round(npvMyr, 0),
    irrPercent,
    emissionsSavedTco2e: round(emissionsSavedTco2e, 0),
    sopPlantType: "Combined Cycle Power Plant" as const,
    sopHeatRateBtuKwh: SOP_CCPP_HEAT_RATE_BTU_KWH,
    sopNetEfficiencyPercent: SOP_CCPP_NET_EFFICIENCY_PERCENT,
    purpaEfficiencyPercent: round(purpaEfficiencyRaw, 1),
    purpaQualified,
    ambientDeratePercent: round(ambientDeratePercentRaw, 1),
    ambientAdjustedGrossPowerMw: round(grossPowerMw, 2),
    hrsgSteamTph: round(hrsgSteamTph, 1),
    availabilityPercent: round(availabilityRaw, 1),
    reliabilityPercent: round(reliabilityRaw, 1),
    riskScoreMyr: round(riskScoreMyr, 0),
    capexStack: capexStack(capexMyr),
    lccStack: lccStack(capexMyr, cogenCostMyr, input.projectLifeYears),
    eecaEnergyGJ: round(eecaEnergyGJ, 0),
    eecaStatus,
    issueStatus: (checks.some((check) => check.status === "block") ? "Draft blocked" : "Issue ready") as "Draft blocked" | "Issue ready",
    completeness,
    checks,
  };

  return {
    ...resultBase,
    streams: buildStreams(input, resultBase),
  };
}

export { CALCULATION_VERSION };
