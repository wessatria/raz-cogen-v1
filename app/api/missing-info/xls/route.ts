import { NextResponse } from "next/server";
import type { CogenInput, EvidenceAttachment, InputEvidence } from "@/lib/cogen/model";

export const runtime = "nodejs";

type MissingInfoRequest = {
  input: CogenInput;
  evidence: InputEvidence[];
  attachments?: EvidenceAttachment[];
};

type RequestRow = {
  section: string;
  item: string;
  status: string;
  why: string;
  unit: string;
  preferredEvidence: string;
  notes: string;
};

const brand = {
  green: "#235F52",
  gold: "#C79A32",
  ink: "#17202A",
  grey: "#EEF2F6",
  pale: "#F7FAF9",
  red: "#B42318",
};

const standardRows: RequestRow[] = [
  {
    section: "Electrical baseline",
    item: "Latest 12 months TNB bills and tariff schedule",
    status: "Required if not already attached",
    why: "Validates annual kWh, maximum demand, tariff category, ICPT/charges and billing anomalies.",
    unit: "PDF / RM / kWh / kW",
    preferredEvidence: "TNB monthly bills covering a continuous 12-month period",
    notes: "Please include all pages, including charge breakdown pages.",
  },
  {
    section: "Electrical baseline",
    item: "Half-hourly or 15-minute interval demand data",
    status: "Required if not already attached",
    why: "Confirms true electrical base load and whether export should be studied.",
    unit: "kW / MW time series",
    preferredEvidence: "Meter export CSV/XLSX or TNB/EMS report",
    notes: "Minimum one representative month; preferably 12 months.",
  },
  {
    section: "Thermal baseline",
    item: "Steam demand profile by shift/day and minimum coincident steam load",
    status: "Required if estimated",
    why: "Cogeneration must be heat-led to avoid oversizing and wasted recoverable heat.",
    unit: "t/h, bar(g), deg C",
    preferredEvidence: "Boiler log sheet, steam flowmeter trend, production log",
    notes: "Please identify shutdown, cleaning and low-production periods.",
  },
  {
    section: "Fuel baseline",
    item: "Natural gas invoices or contract price basis",
    status: "Required if price is estimated",
    why: "Fuel price drives both BAU boiler cost and cogeneration operating cost.",
    unit: "RM/MMBtu",
    preferredEvidence: "Gas invoices, contract schedule or supplier quotation",
    notes: "Please include take-or-pay, minimum bill or escalation terms if applicable.",
  },
  {
    section: "Utility / TNB",
    item: "TNB infrastructure recovery, capital contribution or unamortized asset claim",
    status: "New placeholder to confirm",
    why: "Captures potential one-time recovery cost if cogeneration reduces grid consumption before TNB fully capitalizes customer-specific infrastructure.",
    unit: "RM",
    preferredEvidence: "TNB letter, connection agreement, contribution schedule or customer correspondence",
    notes: "Enter zero only after confirming no recovery claim is expected.",
  },
  {
    section: "Site and approvals",
    item: "Electrical single-line diagram, incomer voltage and transformer details",
    status: "Required before feasibility",
    why: "Supports interconnection, protection, metering and tie-in review.",
    unit: "Drawings / kV / kVA",
    preferredEvidence: "Latest SLD, transformer nameplates, switchboard drawings",
    notes: "Mark available spare bays and critical loads if known.",
  },
  {
    section: "Site and approvals",
    item: "Available plot/plantroom location and site constraints",
    status: "Required before budget firm-up",
    why: "Affects equipment layout, exhaust routing, gas tie-in, civils and installation cost.",
    unit: "Photos / layout / constraints",
    preferredEvidence: "Site plan, photos, utility routing, access limitations",
    notes: "Include hazardous area, noise-sensitive boundary or roof/space limitations.",
  },
  {
    section: "Customer decision",
    item: "Commercial constraints and decision criteria",
    status: "Requested",
    why: "Clarifies target payback, approval process, financing preference and proposal framing.",
    unit: "Text / RM / years",
    preferredEvidence: "Internal hurdle rate, budget window, procurement timeline",
    notes: "Please identify decision makers and expected approval timeline.",
  },
];

function escapeHtml(value: string | number | undefined | null) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeFilename(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase() || "missing-info";
}

function evidenceRows(evidence: InputEvidence[]): RequestRow[] {
  return evidence
    .filter((item) => item.status === "estimated" || item.status === "not available" || item.confidence !== "high")
    .map((item) => ({
      section: "Current evidence gap",
      item: item.label,
      status: `${item.status} / ${item.confidence} confidence`,
      why: `The current screening basis uses ${item.source}. Please provide a stronger source or confirm the value manually.`,
      unit: "As applicable",
      preferredEvidence: "Customer source document or written confirmation",
      notes: `Linked input: ${String(item.key)}`,
    }));
}

function workbookHtml(payload: MissingInfoRequest, generatedAt: string) {
  const rows = [...evidenceRows(payload.evidence), ...standardRows];
  const attachmentList = (payload.attachments ?? []).map((item) => `${item.fileName} (${item.confidence})`).join("; ") || "No uploaded attachments recorded in this draft.";
  const rowHtml = rows.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(row.section)}</td>
      <td>${escapeHtml(row.item)}</td>
      <td>${escapeHtml(row.status)}</td>
      <td>${escapeHtml(row.why)}</td>
      <td class="response"></td>
      <td>${escapeHtml(row.unit)}</td>
      <td>${escapeHtml(row.preferredEvidence)}</td>
      <td>${escapeHtml(row.notes)}</td>
    </tr>`).join("");

  return `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Arial, sans-serif; color: ${brand.ink}; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #C9D4DF; padding: 8px; vertical-align: top; font-size: 11pt; }
  .brand { background: ${brand.green}; color: #FFFFFF; font-weight: bold; font-size: 20pt; }
  .subtitle { background: ${brand.gold}; color: #17202A; font-weight: bold; font-size: 14pt; }
  .meta { background: ${brand.pale}; font-weight: bold; width: 210px; }
  th { background: ${brand.green}; color: #FFFFFF; font-weight: bold; }
  .response { background: #FFF8E5; min-width: 260px; }
  .note { background: ${brand.grey}; color: #475467; }
  .missing { color: ${brand.red}; font-weight: bold; }
</style>
</head>
<body>
<table>
  <tr><td class="brand" colspan="9">RAZ ENGINEERING SDN. BHD.</td></tr>
  <tr><td class="subtitle" colspan="9">Cogeneration Screening - Missing Information Request Form</td></tr>
  <tr><td class="meta">Prepared for</td><td colspan="8">${escapeHtml(payload.input.clientName)}</td></tr>
  <tr><td class="meta">Site</td><td colspan="8">${escapeHtml(payload.input.siteName)}, ${escapeHtml(payload.input.state)}</td></tr>
  <tr><td class="meta">Generated</td><td colspan="8">${escapeHtml(generatedAt)}</td></tr>
  <tr><td class="meta">Purpose</td><td colspan="8">Please complete the yellow customer response cells and attach the preferred evidence where available. This closes information gaps before Raz Engineering prepares the next feasibility/proposal revision.</td></tr>
  <tr><td class="meta">Uploaded files in draft</td><td colspan="8">${escapeHtml(attachmentList)}</td></tr>
  <tr><td class="note" colspan="9"><span class="missing">Customer action:</span> Fill the yellow cells, attach supporting documents, and return this workbook by e-mail to Raz Engineering.</td></tr>
  <tr>
    <th>No.</th><th>Section</th><th>Required information</th><th>Current status</th><th>Why needed</th><th>Customer response</th><th>Unit</th><th>Preferred evidence</th><th>Notes</th>
  </tr>
  ${rowHtml}
</table>
</body>
</html>`;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as MissingInfoRequest;
  const generatedAt = new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
  const html = workbookHtml(payload, generatedAt);
  const filename = `${sanitizeFilename(payload.input.clientName)}-${sanitizeFilename(payload.input.siteName)}-missing-info-request.xls`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
