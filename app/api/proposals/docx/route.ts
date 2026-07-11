import { NextResponse } from "next/server";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { calculateCogen, CALCULATION_VERSION } from "@/lib/cogen/calculate";
import type { CogenInput, InputEvidence } from "@/lib/cogen/model";

export const runtime = "nodejs";

type ProposalRequest = {
  input: CogenInput;
  evidence: InputEvidence[];
};

const brand = {
  green: "235F52",
  gold: "C79A32",
  ink: "17202A",
  grey: "EEF2F6",
  red: "B42318",
};

function formatMyr(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("en-MY", {
    maximumFractionDigits: digits,
  }).format(value);
}

function cell(text: string, options: { bold?: boolean; shade?: string; color?: string; align?: typeof AlignmentType[keyof typeof AlignmentType] } = {}) {
  return new TableCell({
    shading: options.shade ? { fill: options.shade, type: ShadingType.CLEAR, color: "auto" } : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "D9E0E8" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "D9E0E8" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "D9E0E8" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "D9E0E8" },
    },
    children: [
      new Paragraph({
        alignment: options.align,
        children: [
          new TextRun({
            text,
            bold: options.bold,
            color: options.color ?? brand.ink,
            size: 19,
          }),
        ],
      }),
    ],
  });
}

function table(rows: string[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((row, rowIndex) =>
      new TableRow({
        children: row.map((item) =>
          cell(item, {
            bold: rowIndex === 0,
            shade: rowIndex === 0 ? brand.green : undefined,
            color: rowIndex === 0 ? "FFFFFF" : brand.ink,
          }),
        ),
      }),
    ),
  });
}

function para(text: string, options: { bold?: boolean; color?: string } = {}) {
  return new Paragraph({
    spacing: { after: 160 },
    children: [new TextRun({ text, size: 21, bold: options.bold, color: options.color ?? brand.ink })],
  });
}

function heading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120 },
    children: [new TextRun({ text, bold: true, color: brand.green, size: 28 })],
  });
}

function sanitizeFilename(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase() || "proposal";
}

export async function POST(request: Request) {
  const payload = (await request.json()) as ProposalRequest;
  const result = calculateCogen(payload.input, payload.evidence);
  const status = result.issueStatus === "Issue ready" ? "READY TO ISSUE" : "DRAFT";
  const generatedAt = new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());

  const doc = new Document({
    creator: "Raz Engineering Sdn. Bhd.",
    title: `Budget-Level Cogeneration Proposal - ${payload.input.clientName}`,
    description: "Raz CogenScreen MY budget-level cogeneration proposal",
    styles: {
      default: {
        document: {
          run: { font: "Arial", color: brand.ink },
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, right: 850, bottom: 850, left: 850 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: "RAZ ENGINEERING SDN. BHD.", bold: true, color: brand.green, size: 18 }),
                  new TextRun({ text: " | CogenScreen MY", color: brand.ink, size: 18 }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Confidential budget-level screening. Not an OEM guarantee, statutory audit, regulatory approval, tax opinion, construction design or binding offer.",
                    color: "667085",
                    size: 16,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            spacing: { after: 180 },
            children: [new TextRun({ text: "RAZ ENGINEERING", bold: true, color: brand.green, size: 44 })],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: "Budget-Level Cogeneration Proposal", bold: true, color: brand.ink, size: 36 })],
          }),
          new Paragraph({
            spacing: { after: 360 },
            children: [new TextRun({ text: "CogenScreen MY preliminary assessment", color: "475467", size: 22 })],
          }),
          status === "DRAFT"
            ? new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 260 },
                children: [new TextRun({ text: "DRAFT", bold: true, color: brand.red, size: 56 })],
              })
            : new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 260 },
                children: [new TextRun({ text: "READY TO ISSUE", bold: true, color: brand.green, size: 30 })],
              }),
          table([
            ["Prepared for", payload.input.clientName],
            ["Site", `${payload.input.siteName}, ${payload.input.state}`],
            ["Industry", payload.input.industry],
            ["Prepared by", "Raz Engineering Sdn. Bhd."],
            ["Generated", generatedAt],
            ["Calculation version", CALCULATION_VERSION],
            ["Template version", "budget-template-1.0"],
            ["Validity", "60 days from issue unless superseded"],
          ]),
          new Paragraph({ children: [new PageBreak()] }),

          heading("1. Executive Indication"),
          para(
            `Based on the information currently available, Raz Engineering has identified a preliminary ${result.netPowerMw} MW net ${result.selectedTechnology.toLowerCase()} cogeneration configuration sized primarily against the site's minimum coincident useful-heat demand and electrical base load.`,
          ),
          table([
            ["Metric", "Screening result"],
            ["Annual generation", `${formatNumber(result.annualGenerationMwh)} MWh/year`],
            ["Useful heat", `${formatNumber(result.usefulHeatGJYear)} GJ/year`],
            ["Fuel input", `${formatNumber(result.fuelInputMmbtuYear)} MMBtu/year`],
            ["Indicative installed CAPEX", formatMyr(result.capexMyr)],
            ["Annual saving", formatMyr(result.annualSavingMyr)],
            ["Simple payback", result.simplePaybackYears ? `${result.simplePaybackYears} years` : "Not achieved"],
            ["Proposal status", status],
          ]),

          heading("2. Customer Baseline and Data Quality"),
          table([
            ["Item", "Current basis", "Data quality/source"],
            ["Annual electricity", `${formatNumber(payload.input.annualElectricityMwh)} MWh`, "12-month electricity bills"],
            ["Peak / base demand", `${payload.input.peakDemandMw} / ${payload.input.baseDemandMw} MW`, "Interval demand data"],
            ["Annual boiler fuel", `${formatNumber(payload.input.annualBoilerFuelMmbtu)} MMBtu`, "Boiler fuel invoices"],
            ["Average / minimum / peak steam", `${payload.input.averageSteamTph} / ${payload.input.minimumSteamTph} / ${payload.input.peakSteamTph} t/h`, "Production and steam profile"],
            ["Steam conditions", `${payload.input.steamPressureBarg} bar(g), ${payload.input.steamTemperatureC} C`, "Customer supplied basis"],
            ["Operating hours", `${formatNumber(payload.input.operatingHours)} h/year`, "Operating calendar"],
            ["Evidence completeness", `${result.completeness}%`, "Provided or derived material inputs"],
          ]),

          heading("3. Recommended Configuration"),
          table([
            ["Item", "Recommendation"],
            ["Prime mover", result.selectedTechnology],
            ["Number of units", `${result.unitCount}`],
            ["Net electrical capacity", `${result.netPowerMw} MW`],
            ["Gross electrical capacity", `${result.grossPowerMw} MW`],
            ["Useful heat output", `${result.usefulHeatMwBase} MWth base, ${result.usefulHeatMwAverage} MWth average`],
            ["Operating strategy", "Heat-led, capped at electrical base load unless export is approved"],
            ["Export assumption", payload.input.exportEnabled && payload.input.exportApproved ? "Approved export scenario" : "No export revenue assumed"],
          ]),

          heading("4. Preliminary Heat and Mass Balance"),
          table([
            ["No.", "Medium", "Mass", "Pressure", "Temperature", "Energy", "Basis"],
            ...result.streams.map((stream) => [
              `${stream.no}`,
              stream.medium,
              stream.mass,
              stream.pressure,
              stream.temperature,
              stream.energy,
              stream.basis,
            ]),
          ]),

          heading("5. Budget Economics"),
          table([
            ["Metric", "Base case"],
            ["Business-as-usual annual cost", formatMyr(result.bauCostMyr)],
            ["Cogeneration annual cost", formatMyr(result.cogenCostMyr)],
            ["Annual saving", formatMyr(result.annualSavingMyr)],
            ["Installed CAPEX", formatMyr(result.capexMyr)],
            ["Power-only LCOE", `RM ${result.lcoeMyrKwh}/kWh`],
            ["Net electricity cost after heat credit", `RM ${result.heatCreditNetPowerMyrKwh}/kWh`],
            ["NPV", formatMyr(result.npvMyr)],
            ["Project IRR", result.irrPercent === null ? "Not achieved" : `${result.irrPercent}%`],
            ["Emissions saved", `${formatNumber(result.emissionsSavedTco2e)} tCO2e/year`],
          ]),

          heading("6. EECA and Project-Approval Screen"),
          table([
            ["Gate", "Status / next action"],
            ["Combined 12-month energy", `${formatNumber(result.eecaEnergyGJ)} GJ`],
            ["EECA threshold screen", result.eecaStatus],
            ["REM / EnMS / reporting / audit", result.eecaStatus === "Applicable" ? "Confirm customer status and obligation timeline" : "Monitor if load changes"],
            ["Generating licence pathway", "Review with Energy Commission / competent authority"],
            ["Utility interconnection, protection and metering", "Confirm with utility and project electrical study"],
            ["Export / NEDA", payload.input.exportEnabled && payload.input.exportApproved ? "Approved route recorded" : "Not assumed"],
            ["Gas supply, environmental, planning, fire and local approvals", "Confirm during paid feasibility study"],
          ]),
          para("EECA applicability is not a cogeneration project approval. Final requirements must be confirmed with the Energy Commission, utility/Single Buyer and other competent authorities."),

          heading("7. Issue Gates"),
          table([
            ["Gate", "Severity", "Message"],
            ...(result.checks.length
              ? result.checks.map((check) => [check.gate, check.status, check.message])
              : [["All", "pass", "No active warnings or blockers."]]),
          ]),

          heading("8. Recommended Next Engagement"),
          para(
            "Raz Engineering recommends a paid feasibility study covering interval-data validation, site walkdown, metering plan, verified heat and mass balance, OEM budget quotation, utility and regulatory pre-consultation, layout and tie-in review, risk register, implementation programme and investment-grade financial model.",
          ),

          heading("9. Disclaimer"),
          para(
            "This assessment is a budget-level screening based on information supplied by the customer and stated assumptions. It is not an OEM guarantee, statutory energy audit, regulatory approval, tax opinion, construction design or binding offer. Final performance, cost, savings, emissions, approvals and programme are subject to verified operating data, site assessment, utility and authority engagement, OEM quotation and detailed engineering.",
          ),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `${sanitizeFilename(payload.input.clientName)}-${sanitizeFilename(payload.input.siteName)}-cogen-proposal.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
