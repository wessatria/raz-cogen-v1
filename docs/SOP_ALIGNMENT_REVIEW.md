# SOP Calculation Alignment Review

Source reviewed: `Cogen SOP Version 1.docx` supplied by the user.

## Formulas and Benchmarks Added

- CCPP benchmark: heat rate `6,203 Btu/kWh` and net efficiency `55%` from SOP Table 1.
- SOP/PURPA efficiency: `(Electric Output + 0.5 x Thermal Output) / Energy Input (LHV)` with `42.5%` threshold.
- HRSG screening steam flow: `m_steam = m_air x cp x (T2 - T1) x K / (h2 - h1)` using `K = 0.985` and editable exhaust/enthalpy inputs.
- Ambient derate: `0.5%` gross power output reduction per `1 F` rise above reference ambient temperature.
- Availability: `(PT - PM - FO - EFH) / PT` using annual period `8,760 h`.
- Reliability: `(PT - FO - EFH) / PT` using annual period `8,760 h`.
- Risk score: `Probability of Failure x Consequences of Failure`.
- Capital stack: Gas Turbine 30%, Steam Turbine 10%, HRSG 10%, Mechanical 15%, Electrical 12%, Controls 3%, Civil & Infrastructure 20%.
- LCC stack: Fuel 75%, O&M 17%, Initial Capital 8%.

## App Alignment Decisions

- The app remains a budget-level screening tool, not an OEM design model.
- SOP formulas are implemented as a visible screening overlay and gate register inputs, so reviewers can see what passes, what is estimated, and what needs OEM confirmation.
- Ambient derate now affects gross and net power before generation, payback, NPV, IRR, LCOE and emissions are calculated.
- SOP/PURPA efficiency is a regulatory gate. Below `42.5%` creates a blocking gate.
- HRSG steam-flow output is compared against minimum steam demand and creates an engineering warning when the estimate is short.
- Availability below `92%` creates an engineering warning.
- Calculation version is now `0.2.0-sop`.

## Not Yet Fully Automated

- Detailed Brayton cycle compressor/turbine enthalpy calculations need OEM pressure-ratio, firing-temperature and state-point data.
- Detailed Rankine cycle HP/IP/LP extraction modelling needs steam-turbine vendor data and process steam headers.
- Inlet cooling/chilling ROI is flagged by ambient derate but not yet modelled as its own capex/opex scenario.
- Carbon capture penalty is noted in the SOP but not yet exposed as a scenario toggle.
- Energy Commission-specific final approval/licensing workflow still needs authority checklist data before it can be more than a gate reminder.
