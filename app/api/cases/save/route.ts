import { NextResponse } from "next/server";
import { calculateCogen, CALCULATION_VERSION } from "@/lib/cogen/calculate";
import type { CogenInput, EvidenceAttachment, InputEvidence } from "@/lib/cogen/model";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type SaveCaseRequest = {
  input: CogenInput;
  evidence: InputEvidence[];
  attachments?: EvidenceAttachment[];
};

function caseCode(input: CogenInput) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const client = input.clientName.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").slice(0, 24).toUpperCase();
  return `RCG-${stamp}-${client || "CASE"}`;
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    bytes: Buffer.from(match[2], "base64"),
  };
}

function storageName(fileName: string) {
  return fileName.replace(/[^a-z0-9.\-_]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase();
}
function inputRows(caseId: string, input: CogenInput, evidence: InputEvidence[]) {
  const evidenceByKey = new Map(evidence.map((item) => [item.key, item]));
  const labels: Record<keyof CogenInput, { label: string; unit?: string }> = {
    clientName: { label: "Client name" },
    siteName: { label: "Site name" },
    industry: { label: "Industry" },
    state: { label: "State" },
    annualElectricityMwh: { label: "Annual electricity", unit: "MWh/y" },
    peakDemandMw: { label: "Peak demand", unit: "MW" },
    baseDemandMw: { label: "Electrical base load", unit: "MW" },
    annualBoilerFuelMmbtu: { label: "Annual boiler fuel", unit: "MMBtu/y" },
    averageSteamTph: { label: "Average steam", unit: "t/h" },
    minimumSteamTph: { label: "Minimum coincident steam", unit: "t/h" },
    peakSteamTph: { label: "Peak steam", unit: "t/h" },
    steamPressureBarg: { label: "Steam pressure", unit: "bar(g)" },
    steamTemperatureC: { label: "Steam temperature", unit: "C" },
    condensateReturnPercent: { label: "Condensate return", unit: "%" },
    boilerEfficiencyPercent: { label: "Boiler efficiency", unit: "%" },
    operatingHours: { label: "Operating hours", unit: "h/y" },
    gridEnergyTariffMyrKwh: { label: "Grid energy tariff", unit: "RM/kWh" },
    demandChargeMyrKwMonth: { label: "Demand charge", unit: "RM/kW-month" },
    gasPriceMyrMmbtu: { label: "Gas price", unit: "RM/MMBtu" },
    waterTreatmentMyrGJ: { label: "Water treatment", unit: "RM/GJ" },
    capexMyrPerMw: { label: "Installed CAPEX", unit: "RM/MW" },
    fixedOmMyrKwYear: { label: "Fixed O&M", unit: "RM/kW-y" },
    variableOmMyrMwh: { label: "Variable O&M", unit: "RM/kWh" },
    overhaulReserveMyrMwh: { label: "Overhaul reserve", unit: "RM/kWh" },
    projectLifeYears: { label: "Project life", unit: "years" },
    discountRatePercent: { label: "Discount rate", unit: "%" },
    carbonPriceMyrTonne: { label: "Carbon scenario", unit: "RM/tCO2e" },
    tnbInfrastructureRecoveryMyr: { label: "TNB infrastructure recovery", unit: "RM" },
    ambientTemperatureC: { label: "Ambient temperature", unit: "C" },
    referenceAmbientTemperatureC: { label: "Derate reference temperature", unit: "C" },
    exhaustMassFlowKgS: { label: "Gas turbine exhaust mass flow", unit: "kg/s" },
    exhaustTemperatureC: { label: "Gas turbine exhaust temperature", unit: "C" },
    stackTemperatureC: { label: "Stack exhaust temperature", unit: "C" },
    steamEnthalpyRiseKjKg: { label: "Steam enthalpy rise", unit: "kJ/kg" },
    plannedMaintenanceHours: { label: "Planned maintenance", unit: "h/y" },
    forcedOutageHours: { label: "Forced outage", unit: "h/y" },
    equivalentForcedOutageHours: { label: "Equivalent forced outage", unit: "h/y" },
    riskProbabilityPercent: { label: "Failure probability", unit: "%" },
    riskConsequenceMyr: { label: "Failure consequence", unit: "RM" },
    exportEnabled: { label: "Export enabled" },
    exportApproved: { label: "Export approved" },
    incentiveConfirmed: { label: "Incentive confirmed" },
    incentiveMyr: { label: "Incentive value", unit: "RM" },
    technicalApproved: { label: "Technical approval" },
    commercialApproved: { label: "Commercial approval" },
  };

  return Object.entries(input).map(([key, value]) => {
    const typedKey = key as keyof CogenInput;
    const evidenceItem = evidenceByKey.get(typedKey);
    return {
      case_id: caseId,
      input_key: key,
      label: labels[typedKey].label,
      value: typeof value === "number" ? value : typeof value === "boolean" ? (value ? 1 : 0) : null,
      unit: labels[typedKey].unit ?? null,
      status: evidenceItem?.status ?? (typeof value === "string" ? "provided" : "estimated"),
      source: evidenceItem?.source ?? "Engineer entry",
      confidence: evidenceItem?.confidence ?? "medium",
      reviewer_note: typeof value === "string" ? value : null,
    };
  });
}

export async function POST(request: Request) {
  const supabase = createAdminClient();

  if (!supabase) {
    return NextResponse.json(
      {
        error: "Database save is not configured. Add SUPABASE_SERVICE_ROLE_KEY to Vercel/local env and apply the Supabase migrations.",
      },
      { status: 503 },
    );
  }

  const payload = (await request.json()) as SaveCaseRequest;
  const result = calculateCogen(payload.input, payload.evidence);
  const code = caseCode(payload.input);

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      legal_name: payload.input.clientName,
      industry: payload.input.industry,
      confidentiality_status: "confidential",
    })
    .select("id")
    .single();
  if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 });

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .insert({
      client_id: client.id,
      name: payload.input.siteName,
      state: payload.input.state,
      jurisdiction: "Peninsular Malaysia",
      gas_supply_status: "to be confirmed",
    })
    .select("id")
    .single();
  if (siteError) return NextResponse.json({ error: siteError.message }, { status: 500 });

  const { data: savedCase, error: caseError } = await supabase
    .from("cases")
    .insert({
      case_code: code,
      client_id: client.id,
      site_id: site.id,
      owner_name: "Raz engineer",
      stage: result.issueStatus === "Issue ready" ? "issue" : "review",
      probability: 0.35,
      revision: 0,
      calculation_version: CALCULATION_VERSION,
      issue_status: result.issueStatus,
    })
    .select("id, case_code")
    .single();
  if (caseError) return NextResponse.json({ error: caseError.message }, { status: 500 });

  const caseId = savedCase.id as string;

  const { error: inputsError } = await supabase.from("case_inputs").insert(inputRows(caseId, payload.input, payload.evidence));
  if (inputsError) return NextResponse.json({ error: inputsError.message }, { status: 500 });

  const savedAttachments: Array<{ attachment: EvidenceAttachment; storagePath: string | null; hash: string | null }> = [];
  for (const attachment of payload.attachments ?? []) {
    let storagePath: string | null = null;
    let hash: string | null = null;
    if (attachment.dataUrl) {
      const decoded = decodeDataUrl(attachment.dataUrl);
      if (decoded) {
        storagePath = `${caseId}/${attachment.id}-${storageName(attachment.fileName)}`;
        hash = `${attachment.sizeBytes}-${attachment.fileName}`;
        const { error: uploadError } = await supabase.storage
          .from("case-evidence")
          .upload(storagePath, decoded.bytes, {
            contentType: decoded.mimeType,
            upsert: true,
          });
        if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }
    }
    savedAttachments.push({ attachment, storagePath, hash });
  }
  if (payload.evidence.length > 0) {
    const { error: evidenceError } = await supabase.from("evidence").insert(
      payload.evidence.map((item) => ({
        case_id: caseId,
        linked_input_key: item.key,
        file_name: item.label,
        source_type: item.status,
        date_range: "12 months / screening basis",
        confidence: item.confidence,
      })),
    );
    if (evidenceError) return NextResponse.json({ error: evidenceError.message }, { status: 500 });
  }


  if (savedAttachments.length > 0) {
    const { error: attachmentEvidenceError } = await supabase.from("evidence").insert(
      savedAttachments.map(({ attachment, storagePath, hash }) => ({
        case_id: caseId,
        linked_input_key: attachment.linkedInputKey,
        file_name: attachment.fileName,
        source_type: attachment.sourceType,
        date_range: attachment.note || "Uploaded evidence attachment",
        file_hash: hash ?? storagePath,
        confidence: attachment.confidence,
      })),
    );
    if (attachmentEvidenceError) return NextResponse.json({ error: attachmentEvidenceError.message }, { status: 500 });
  }
  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .insert({
      case_id: caseId,
      name: "Base screening case",
      sizing_mode: "heat-led",
      technology: result.selectedTechnology,
      unit_count: result.unitCount,
      assumptions: {
        input: payload.input,
        evidenceCompleteness: result.completeness,
      },
      selected_configuration: {
        netPowerMw: result.netPowerMw,
        grossPowerMw: result.grossPowerMw,
        usefulHeatMwBase: result.usefulHeatMwBase,
        usefulHeatMwAverage: result.usefulHeatMwAverage,
      },
      rejected_alternatives: [],
      technical_review_status: payload.input.technicalApproved ? "approved" : "pending",
      commercial_review_status: payload.input.commercialApproved ? "approved" : "pending",
    })
    .select("id")
    .single();
  if (scenarioError) return NextResponse.json({ error: scenarioError.message }, { status: 500 });

  const scenarioId = scenario.id as string;

  const { error: streamsError } = await supabase.from("hmb_streams").insert(
    result.streams.map((stream) => ({
      scenario_id: scenarioId,
      stream_no: stream.no,
      medium: stream.medium,
      mass_flow: null,
      mass_unit: stream.mass,
      pressure: null,
      pressure_unit: stream.pressure,
      temperature: null,
      temperature_unit: stream.temperature,
      energy: null,
      energy_unit: stream.energy,
      basis: stream.basis,
      source: "CogenScreen MY calculation",
      confidence: stream.confidence,
    })),
  );
  if (streamsError) return NextResponse.json({ error: streamsError.message }, { status: 500 });

  const { error: financialError } = await supabase.from("financial_cases").insert({
    scenario_id: scenarioId,
    capex_myr: result.capexMyr,
    annual_opex_myr: result.cogenCostMyr,
    annual_saving_myr: result.annualSavingMyr,
    simple_payback_years: result.simplePaybackYears,
    lcoe_myr_per_kwh: result.lcoeMyrKwh,
    heat_credit_net_power_myr_per_kwh: result.heatCreditNetPowerMyrKwh,
    npv_myr: result.npvMyr,
    irr_percent: result.irrPercent,
    emissions_tco2e_saved: result.emissionsSavedTco2e,
    results: result,
  });
  if (financialError) return NextResponse.json({ error: financialError.message }, { status: 500 });

  const gates = result.checks.length
    ? result.checks
    : [{ gate: "review", status: "pass", message: "No active warnings or blockers." }];
  const { error: gatesError } = await supabase.from("compliance_gates").insert(
    gates.map((check, index) => ({
      case_id: caseId,
      gate_key: `${check.gate}-${index + 1}`,
      label: check.gate,
      status: check.status,
      owner_name: check.gate === "commercial" ? "Commercial reviewer" : "Technical reviewer",
      evidence: "CogenScreen MY snapshot",
      next_action: check.message,
    })),
  );
  if (gatesError) return NextResponse.json({ error: gatesError.message }, { status: 500 });

  const { error: proposalError } = await supabase.from("proposals").insert({
    case_id: caseId,
    scenario_id: scenarioId,
    template_version: "budget-template-1.0",
    calculation_version: CALCULATION_VERSION,
    status: result.issueStatus,
    watermark: result.issueStatus === "Issue ready" ? "READY TO ISSUE" : "DRAFT",
    snapshot: {
      input: payload.input,
      evidence: payload.evidence,
      result,
    },
    technical_approved_at: payload.input.technicalApproved ? new Date().toISOString() : null,
    commercial_approved_at: payload.input.commercialApproved ? new Date().toISOString() : null,
    issued_at: result.issueStatus === "Issue ready" ? new Date().toISOString() : null,
  });
  if (proposalError) return NextResponse.json({ error: proposalError.message }, { status: 500 });

  const { error: auditError } = await supabase.from("audit_events").insert({
    case_id: caseId,
    actor_name: "Raz engineer",
    event_type: "case_saved",
    field_path: "case.snapshot",
    new_value: {
      caseCode: savedCase.case_code,
      calculationVersion: CALCULATION_VERSION,
      issueStatus: result.issueStatus,
    },
    reason: "Engineer saved screening case from CogenScreen MY",
  });
  if (auditError) return NextResponse.json({ error: auditError.message }, { status: 500 });

  return NextResponse.json({
    caseId,
    caseCode: savedCase.case_code,
    scenarioId,
    issueStatus: result.issueStatus,
    savedAt: new Date().toISOString(),
  });
}
