# User Journey Snapshot

```mermaid
flowchart TD
  A["Lead / customer identified"] --> B["Create case and key site basics"]
  B --> C["Upload evidence: PDFs and images"]
  C --> D["Extract suggestions from uploaded documents"]
  D --> E["Engineer reviews and edits extracted values"]
  E --> F["Complete load, thermal, commercial and SOP inputs"]
  F --> G["Click Calculate"]
  G --> H["Run heat-led sizing, SOP formula checks and financial model"]
  H --> I{"Issue gates clear?"}
  I -->|"No"| J["Generate Missing Info Excel for customer"]
  J --> C
  I -->|"Yes"| K["Generate Raz branded Word proposal"]
  K --> L["Save case to database"]
  L --> M["Submit technical and commercial approvals"]
  M --> N["Issue proposal to customer"]
  N --> O["Expand to paid feasibility / OEM validation"]

  H --> H1["DONE: CCPP benchmark, PURPA efficiency, HRSG steam estimate, ambient derate, availability, reliability and risk score"]
  H --> H2["NOT YET DONE: OEM Brayton / Rankine state-point model"]
  H --> H3["NOT YET DONE: inlet cooling ROI scenario"]
  H --> H4["NOT YET DONE: carbon capture penalty scenario"]
  L --> L1["NOT YET DONE: production DB save blocked until Supabase service role and migrations are applied"]
  O --> O1["SUGGESTED: customer portal for filling missing information online"]
  O --> O2["SUGGESTED: Energy Commission / TNB approval checklist tracker"]
  O --> O3["SUGGESTED: OEM quote comparison and sensitivity scenarios"]
  O --> O4["SUGGESTED: email draft generator with attached missing-info workbook"]

  classDef done fill:#1d4ed8,stroke:#1e40af,color:#ffffff;
  classDef notDone fill:#dc2626,stroke:#991b1b,color:#ffffff;
  classDef suggested fill:#f59e0b,stroke:#b45309,color:#111827;
  classDef decision fill:#ffffff,stroke:#475569,color:#111827;

  class A,B,C,D,E,F,G,H,H1,J,K,N done;
  class I decision;
  class L,M,H2,H3,H4,L1 notDone;
  class O,O1,O2,O3,O4 suggested;
```

## Snapshot Notes

- Blue boxes are working application capabilities.
- Red boxes are not complete or blocked.
- Amber boxes are recommended journey expansions.
- `Save case to database` exists in the app, but production persistence is not complete until Supabase service-role credentials and migrations are applied.
