"use client";

import { useMemo, useState } from "react";
import { calculateCogen, CALCULATION_VERSION } from "@/lib/cogen/calculate";
import { defaultEvidence, defaultInput, type CogenInput, type InputEvidence } from "@/lib/cogen/model";

type NumberField = keyof Pick<CogenInput,
  "annualElectricityMwh" | "peakDemandMw" | "baseDemandMw" | "annualBoilerFuelMmbtu" | "averageSteamTph" |
  "minimumSteamTph" | "peakSteamTph" | "steamPressureBarg" | "steamTemperatureC" | "condensateReturnPercent" |
  "boilerEfficiencyPercent" | "operatingHours" | "gridEnergyTariffMyrKwh" | "demandChargeMyrKwMonth" |
  "gasPriceMyrMmbtu" | "waterTreatmentMyrGJ" | "capexMyrPerMw" | "fixedOmMyrKwYear" |
  "variableOmMyrMwh" | "overhaulReserveMyrMwh" | "projectLifeYears" | "discountRatePercent" |
  "carbonPriceMyrTonne" | "incentiveMyr"
>;

const fieldGroups: Array<{ title: string; fields: Array<{ key: NumberField; label: string; suffix: string }> }> = [
  { title: "Load Evidence", fields: [
    { key: "annualElectricityMwh", label: "Annual electricity", suffix: "MWh/y" },
    { key: "peakDemandMw", label: "Peak demand", suffix: "MW" },
    { key: "baseDemandMw", label: "Electrical base load", suffix: "MW" },
    { key: "annualBoilerFuelMmbtu", label: "Boiler fuel", suffix: "MMBtu/y" },
    { key: "operatingHours", label: "Operating hours", suffix: "h/y" },
  ] },
  { title: "Thermal System", fields: [
    { key: "averageSteamTph", label: "Average steam", suffix: "t/h" },
    { key: "minimumSteamTph", label: "Minimum steam", suffix: "t/h" },
    { key: "peakSteamTph", label: "Peak steam", suffix: "t/h" },
    { key: "steamPressureBarg", label: "Steam pressure", suffix: "bar(g)" },
    { key: "steamTemperatureC", label: "Steam temperature", suffix: "C" },
    { key: "condensateReturnPercent", label: "Condensate return", suffix: "%" },
    { key: "boilerEfficiencyPercent", label: "Boiler efficiency", suffix: "% HHV" },
  ] },
  { title: "Commercial Basis", fields: [
    { key: "gridEnergyTariffMyrKwh", label: "Grid energy", suffix: "RM/kWh" },
    { key: "demandChargeMyrKwMonth", label: "Demand charge", suffix: "RM/kW-mo" },
    { key: "gasPriceMyrMmbtu", label: "Gas price", suffix: "RM/MMBtu" },
    { key: "waterTreatmentMyrGJ", label: "Water treatment", suffix: "RM/GJ" },
    { key: "capexMyrPerMw", label: "Installed CAPEX", suffix: "RM/MW" },
    { key: "fixedOmMyrKwYear", label: "Fixed O&M", suffix: "RM/kW-y" },
    { key: "variableOmMyrMwh", label: "Variable O&M", suffix: "RM/kWh" },
    { key: "overhaulReserveMyrMwh", label: "Overhaul reserve", suffix: "RM/kWh" },
    { key: "projectLifeYears", label: "Project life", suffix: "years" },
    { key: "discountRatePercent", label: "Discount rate", suffix: "%" },
    { key: "carbonPriceMyrTonne", label: "Carbon scenario", suffix: "RM/tCO2e" },
    { key: "incentiveMyr", label: "Confirmed incentive", suffix: "RM" },
  ] },
];

function formatMyr(value: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("en-MY", { maximumFractionDigits: digits }).format(value);
}

export default function Home() {
  const [input, setInput] = useState<CogenInput>(defaultInput);
  const [evidence] = useState<InputEvidence[]>(defaultEvidence);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const result = useMemo(() => calculateCogen(input, evidence), [input, evidence]);
  const blocking = result.checks.filter((check) => check.status === "block");
  const warnings = result.checks.filter((check) => check.status === "warning");

  const updateNumber = (key: NumberField, value: string) => {
    setInput((current) => ({ ...current, [key]: value === "" ? 0 : Number(value) }));
  };

  const updateFlag = (key: keyof Pick<CogenInput, "exportEnabled" | "exportApproved" | "incentiveConfirmed" | "technicalApproved" | "commercialApproved">) => {
    setInput((current) => ({ ...current, [key]: !current[key] }));
  };

  const generateWordProposal = async () => {
    setIsGeneratingDocx(true);
    try {
      const response = await fetch("/api/proposals/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, evidence }),
      });

      if (!response.ok) {
        throw new Error("Proposal generation failed");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const filename = disposition?.match(/filename="([^"]+)"/)?.[1] ?? "raz-cogen-proposal.docx";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsGeneratingDocx(false);
    }
  };
  const proposalText = `Budget-Level Cogeneration Proposal\nPrepared for: ${input.clientName}\nSite: ${input.siteName}, ${input.state}\nCalculation version: ${CALCULATION_VERSION}\nStatus: ${result.issueStatus === "Issue ready" ? "READY TO ISSUE" : "DRAFT"}\n\nExecutive indication\nRaz Engineering has identified a preliminary ${result.netPowerMw} MW net ${result.selectedTechnology.toLowerCase()} cogeneration configuration sized primarily against the site's minimum coincident useful-heat demand and electrical base load. The screening case indicates ${formatNumber(result.annualGenerationMwh)} MWh/year, ${formatNumber(result.usefulHeatGJYear)} GJ/year useful heat, ${formatNumber(result.fuelInputMmbtuYear)} MMBtu/year fuel input, indicative installed CAPEX of ${formatMyr(result.capexMyr)}, annual saving of ${formatMyr(result.annualSavingMyr)}, and simple payback of ${result.simplePaybackYears ?? "not achieved"} years.\n\nEECA screen: ${result.eecaStatus} at ${formatNumber(result.eecaEnergyGJ)} GJ over 12 months. EECA applicability is shown separately from cogeneration project approvals. Export revenue is ${input.exportEnabled && input.exportApproved ? "included with approval" : "not assumed"}. Incentives are ${input.incentiveConfirmed ? "included with evidence" : "zero unless confirmed"}.\n\nDisclaimer\nThis assessment is a budget-level screening based on information supplied by the customer and stated assumptions. It is not an OEM guarantee, statutory energy audit, regulatory approval, tax opinion, construction design or binding offer.`;

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#18202a]">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#396a5f]">Raz Engineering internal screening</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-[#111827]">CogenScreen MY</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Heat-led cogeneration sizing, traceable economics, EECA screening, project approval gates, and a controlled proposal snapshot from one calculation record.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="status-chip">Calc {CALCULATION_VERSION}</span>
            <span className={result.issueStatus === "Issue ready" ? "status-chip ready" : "status-chip blocked"}>{result.issueStatus}</span>
            <span className="status-chip">Evidence {result.completeness}%</span>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1500px] gap-5 px-6 py-5 xl:grid-cols-[430px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="panel">
            <div className="panel-head">
              <h2>Case</h2>
              <span>Stage 0-1</span>
            </div>
            <label className="field wide"><span>Client</span><input value={input.clientName} onChange={(event) => setInput({ ...input, clientName: event.target.value })} /></label>
            <label className="field wide"><span>Site</span><input value={input.siteName} onChange={(event) => setInput({ ...input, siteName: event.target.value })} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="field"><span>Industry</span><input value={input.industry} onChange={(event) => setInput({ ...input, industry: event.target.value })} /></label>
              <label className="field"><span>State</span><input value={input.state} onChange={(event) => setInput({ ...input, state: event.target.value })} /></label>
            </div>
          </div>

          {fieldGroups.map((group) => (
            <div className="panel" key={group.title}>
              <div className="panel-head"><h2>{group.title}</h2><span>inputs</span></div>
              <div className="field-grid">
                {group.fields.map((field) => (
                  <label className="field" key={field.key}>
                    <span>{field.label}</span>
                    <div className="unit-input">
                      <input type="number" value={input[field.key]} onChange={(event) => updateNumber(field.key, event.target.value)} />
                      <b>{field.suffix}</b>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="panel">
            <div className="panel-head"><h2>Issue Controls</h2><span>gates</span></div>
            <label className="toggle"><input type="checkbox" checked={input.exportEnabled} onChange={() => updateFlag("exportEnabled")} /><span>Enable export scenario</span></label>
            <label className="toggle"><input type="checkbox" checked={input.exportApproved} onChange={() => updateFlag("exportApproved")} /><span>Export route approved</span></label>
            <label className="toggle"><input type="checkbox" checked={input.incentiveConfirmed} onChange={() => updateFlag("incentiveConfirmed")} /><span>Incentive evidence attached</span></label>
            <label className="toggle"><input type="checkbox" checked={input.technicalApproved} onChange={() => updateFlag("technicalApproved")} /><span>Technical reviewer approved</span></label>
            <label className="toggle"><input type="checkbox" checked={input.commercialApproved} onChange={() => updateFlag("commercialApproved")} /><span>Commercial reviewer approved</span></label>
          </div>
        </aside>

        <div className="space-y-5">
          <section className="warning-band">
            <strong>{blocking.length} blockers</strong>
            <span>{warnings.length} warnings</span>
            <p>{blocking[0]?.message ?? warnings[0]?.message ?? "All issue gates are clear for this screening case."}</p>
          </section>

          <section className="kpi-grid">
            {[
              ["Net capacity", `${result.netPowerMw} MW`, `${result.unitCount} x ${result.selectedTechnology}`],
              ["Useful heat", `${formatNumber(result.usefulHeatGJYear)} GJ/y`, `${result.usefulHeatMwBase} MWth base`],
              ["Annual saving", formatMyr(result.annualSavingMyr), `${result.simplePaybackYears ?? "No"} year payback`],
              ["NPV / IRR", `${formatMyr(result.npvMyr)} / ${result.irrPercent ?? "n/a"}%`, `${input.projectLifeYears} year model`],
              ["LCOE", `RM ${result.lcoeMyrKwh}/kWh`, `Heat credit RM ${result.heatCreditNetPowerMyrKwh}/kWh`],
              ["EECA", result.eecaStatus, `${formatNumber(result.eecaEnergyGJ)} GJ/12 months`],
            ].map(([label, value, note]) => (
              <article className="kpi" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{note}</small>
              </article>
            ))}
          </section>

          <section className="two-col">
            <div className="panel no-pad">
              <div className="panel-head padded"><h2>Gate Register</h2><span>blocking logic</span></div>
              <div className="gate-list">
                {result.checks.map((check, index) => (
                  <div className={`gate ${check.status}`} key={`${check.gate}-${index}`}>
                    <b>{check.gate}</b>
                    <span>{check.status}</span>
                    <p>{check.message}</p>
                  </div>
                ))}
                {result.checks.length === 0 && <div className="empty">No active warnings or blockers.</div>}
              </div>
            </div>

            <div className="panel no-pad">
              <div className="panel-head padded"><h2>Evidence Register</h2><span>source quality</span></div>
              <table>
                <thead><tr><th>Input</th><th>Status</th><th>Confidence</th></tr></thead>
                <tbody>
                  {evidence.map((item) => <tr key={item.key}><td><b>{item.label}</b><small>{item.source}</small></td><td>{item.status}</td><td>{item.confidence}</td></tr>)}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel no-pad">
            <div className="panel-head padded"><h2>Heat and Mass Balance</h2><span>same snapshot as proposal</span></div>
            <table>
              <thead><tr><th>No.</th><th>Medium</th><th>Mass</th><th>Pressure</th><th>Temperature</th><th>Energy</th><th>Basis</th></tr></thead>
              <tbody>{result.streams.map((stream) => <tr key={stream.no}><td>{stream.no}</td><td>{stream.medium}</td><td>{stream.mass}</td><td>{stream.pressure}</td><td>{stream.temperature}</td><td>{stream.energy}</td><td>{stream.basis}</td></tr>)}</tbody>
            </table>
          </section>

          <section className="two-col">
            <div className="panel">
              <div className="panel-head"><h2>Commercial Model</h2><span>annual MYR</span></div>
              <div className="metric-list">
                <p><span>Business-as-usual cost</span><b>{formatMyr(result.bauCostMyr)}</b></p>
                <p><span>Cogeneration case cost</span><b>{formatMyr(result.cogenCostMyr)}</b></p>
                <p><span>Installed CAPEX</span><b>{formatMyr(result.capexMyr)}</b></p>
                <p><span>Emissions saved</span><b>{formatNumber(result.emissionsSavedTco2e)} tCO2e/y</b></p>
                <p><span>Fuel input</span><b>{formatNumber(result.fuelInputMmbtuYear)} MMBtu/y</b></p>
              </div>
            </div>
            <div className="panel proposal">
              <div className="panel-head proposal-head"><div><h2>Proposal Snapshot</h2><span>{result.issueStatus === "Issue ready" ? "approved" : "DRAFT"}</span></div><button className="docx-button" type="button" onClick={generateWordProposal} disabled={isGeneratingDocx}>{isGeneratingDocx ? "Generating..." : "Generate Word Proposal"}</button></div>
              <pre>{proposalText}</pre>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
