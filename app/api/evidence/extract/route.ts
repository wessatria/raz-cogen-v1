import { NextResponse } from "next/server";
import type { EvidenceAttachment, ExtractedInputSuggestion } from "@/lib/cogen/model";

export const runtime = "nodejs";

type ExtractRequest = {
  attachments: EvidenceAttachment[];
};

type Rule = {
  key: ExtractedInputSuggestion["targetKey"];
  label: string;
  unit: string;
  patterns: RegExp[];
  scale?: number;
};

const rules: Rule[] = [
  { key: "annualElectricityMwh", label: "Annual electricity", unit: "MWh/y", patterns: [/annual\s+electricity[^0-9]{0,20}([\d,.]+)\s*mwh/i, /(?:total|usage|consumption)[^0-9]{0,20}([\d,.]+)\s*kwh/i], scale: 0.001 },
  { key: "peakDemandMw", label: "Peak demand", unit: "MW", patterns: [/peak\s+demand[^0-9]{0,20}([\d,.]+)\s*mw/i, /maximum\s+demand[^0-9]{0,20}([\d,.]+)\s*kw/i], scale: 0.001 },
  { key: "baseDemandMw", label: "Electrical base load", unit: "MW", patterns: [/base\s+(?:load|demand)[^0-9]{0,20}([\d,.]+)\s*mw/i] },
  { key: "annualBoilerFuelMmbtu", label: "Annual boiler fuel", unit: "MMBtu/y", patterns: [/annual\s+(?:boiler\s+)?fuel[^0-9]{0,20}([\d,.]+)\s*mmbtu/i, /gas\s+(?:usage|consumption)[^0-9]{0,20}([\d,.]+)\s*mmbtu/i] },
  { key: "averageSteamTph", label: "Average steam", unit: "t/h", patterns: [/average\s+steam[^0-9]{0,20}([\d,.]+)\s*(?:t\/h|tph|ton\/h)/i] },
  { key: "minimumSteamTph", label: "Minimum steam", unit: "t/h", patterns: [/(?:minimum|min)\s+steam[^0-9]{0,20}([\d,.]+)\s*(?:t\/h|tph|ton\/h)/i] },
  { key: "peakSteamTph", label: "Peak steam", unit: "t/h", patterns: [/peak\s+steam[^0-9]{0,20}([\d,.]+)\s*(?:t\/h|tph|ton\/h)/i] },
  { key: "steamPressureBarg", label: "Steam pressure", unit: "bar(g)", patterns: [/steam\s+pressure[^0-9]{0,20}([\d,.]+)\s*bar/i] },
  { key: "steamTemperatureC", label: "Steam temperature", unit: "C", patterns: [/steam\s+temp(?:erature)?[^0-9]{0,20}([\d,.]+)\s*(?:c|°c)/i] },
  { key: "operatingHours", label: "Operating hours", unit: "h/y", patterns: [/operating\s+hours[^0-9]{0,20}([\d,.]+)\s*(?:h|hr|hours)/i] },
  { key: "gridEnergyTariffMyrKwh", label: "Grid energy tariff", unit: "RM/kWh", patterns: [/(?:energy\s+tariff|energy\s+charge)[^0-9]{0,20}([\d,.]+)\s*(?:rm\/kwh|sen\/kwh)/i], scale: 0.01 },
  { key: "demandChargeMyrKwMonth", label: "Demand charge", unit: "RM/kW-month", patterns: [/demand\s+charge[^0-9]{0,20}([\d,.]+)\s*rm\/kw/i] },
  { key: "gasPriceMyrMmbtu", label: "Gas price", unit: "RM/MMBtu", patterns: [/gas\s+price[^0-9]{0,20}([\d,.]+)\s*rm\/mmbtu/i, /fuel\s+price[^0-9]{0,20}([\d,.]+)\s*rm\/mmbtu/i] },
  { key: "boilerEfficiencyPercent", label: "Boiler efficiency", unit: "%", patterns: [/boiler\s+efficiency[^0-9]{0,20}([\d,.]+)\s*%/i] },
];

function classify(attachment: EvidenceAttachment) {
  const text = `${attachment.fileName} ${attachment.note}`.toLowerCase();
  if (/electric|tnb|utility|demand|kwh/.test(text)) return "electricity_bill";
  if (/gas|fuel|mmbtu|boiler/.test(text)) return "gas_invoice";
  if (/steam|production|flow|tph|t\/h/.test(text)) return "steam_log";
  if (/nameplate|model|capacity|equipment/.test(text)) return "equipment_data";
  return "general_evidence";
}

function decodeText(dataUrl?: string) {
  if (!dataUrl) return "";
  const base64 = dataUrl.split(",")[1];
  if (!base64) return "";
  const buffer = Buffer.from(base64, "base64");
  return buffer
    .toString("latin1")
    .replace(/[^\x20-\x7E\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 20000);
}

function numberFrom(match: RegExpMatchArray, scale = 1) {
  const value = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  return Math.round(value * scale * 1000) / 1000;
}

function excerpt(text: string, matchIndex: number) {
  const start = Math.max(0, matchIndex - 50);
  return text.slice(start, matchIndex + 140).trim();
}

export async function POST(request: Request) {
  const payload = (await request.json()) as ExtractRequest;
  const suggestions: ExtractedInputSuggestion[] = [];

  for (const attachment of payload.attachments ?? []) {
    const documentType = classify(attachment);
    const searchable = `${attachment.fileName} ${attachment.note} ${decodeText(attachment.dataUrl)}`;

    for (const rule of rules) {
      for (const pattern of rule.patterns) {
        const match = searchable.match(pattern);
        if (!match || match.index === undefined) continue;
        const value = numberFrom(match, rule.scale);
        if (value === null) continue;

        suggestions.push({
          id: `${attachment.id}-${rule.key}-${suggestions.length}`,
          targetKey: rule.key,
          label: rule.label,
          value,
          unit: rule.unit,
          sourceFile: attachment.fileName,
          documentType,
          confidence: attachment.sourceType === "pdf" ? "medium" : "low",
          reason: "Matched a labelled value in the uploaded document text, file name, or engineer note. Review before applying.",
          excerpt: excerpt(searchable, match.index),
        });
        break;
      }
    }
  }

  return NextResponse.json({ suggestions });
}
