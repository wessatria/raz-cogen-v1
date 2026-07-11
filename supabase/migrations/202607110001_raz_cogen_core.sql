create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  industry text not null,
  contact_name text,
  contact_email text,
  confidentiality_status text not null default 'confidential',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  address text,
  state text not null,
  jurisdiction text not null default 'Peninsular Malaysia',
  connection_voltage_kv numeric,
  gas_supply_status text,
  created_at timestamptz not null default now()
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  case_code text not null unique,
  client_id uuid not null references public.clients(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  owner_name text not null,
  stage text not null default 'qualify',
  probability numeric not null default 0.25 check (probability >= 0 and probability <= 1),
  due_date date,
  revision integer not null default 0,
  calculation_version text not null default '0.1.0',
  issue_status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_inputs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  input_key text not null,
  label text not null,
  value numeric,
  unit text,
  status text not null default 'estimated',
  source text,
  source_date date,
  confidence text not null default 'medium',
  reviewer_note text,
  unique(case_id, input_key)
);

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  linked_input_key text,
  file_name text not null,
  source_type text not null,
  date_range text,
  file_hash text,
  confidence text not null default 'medium',
  created_at timestamptz not null default now()
);

create table if not exists public.scenarios (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  name text not null,
  sizing_mode text not null default 'heat-led',
  technology text not null,
  unit_count integer not null default 1,
  assumptions jsonb not null default '{}',
  selected_configuration jsonb not null default '{}',
  rejected_alternatives jsonb not null default '[]',
  technical_review_status text not null default 'pending',
  commercial_review_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.hmb_streams (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  stream_no integer not null,
  medium text not null,
  mass_flow numeric,
  mass_unit text,
  pressure numeric,
  pressure_unit text,
  temperature numeric,
  temperature_unit text,
  energy numeric,
  energy_unit text,
  basis text not null,
  source text not null,
  confidence text not null default 'medium',
  unique(scenario_id, stream_no)
);

create table if not exists public.financial_cases (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  capex_myr numeric not null,
  annual_opex_myr numeric not null,
  annual_saving_myr numeric not null,
  simple_payback_years numeric,
  lcoe_myr_per_kwh numeric,
  heat_credit_net_power_myr_per_kwh numeric,
  npv_myr numeric,
  irr_percent numeric,
  emissions_tco2e_saved numeric,
  results jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.compliance_gates (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  gate_key text not null,
  label text not null,
  status text not null default 'review',
  owner_name text,
  evidence text,
  next_action text,
  due_date date,
  rule_version text not null default 'PRD 1.0 / EECA 2024',
  unique(case_id, gate_key)
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  template_version text not null default 'budget-template-1.0',
  calculation_version text not null,
  status text not null default 'draft',
  watermark text not null default 'DRAFT',
  snapshot jsonb not null,
  technical_approved_at timestamptz,
  commercial_approved_at timestamptz,
  issued_at timestamptz,
  validity_days integer not null default 60,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  actor_name text not null default 'system',
  event_type text not null,
  field_path text,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;
alter table public.sites enable row level security;
alter table public.cases enable row level security;
alter table public.case_inputs enable row level security;
alter table public.evidence enable row level security;
alter table public.scenarios enable row level security;
alter table public.hmb_streams enable row level security;
alter table public.financial_cases enable row level security;
alter table public.compliance_gates enable row level security;
alter table public.proposals enable row level security;
alter table public.audit_events enable row level security;

create policy "authenticated read clients" on public.clients for select to authenticated using (true);
create policy "authenticated write clients" on public.clients for all to authenticated using (true) with check (true);
create policy "authenticated read sites" on public.sites for select to authenticated using (true);
create policy "authenticated write sites" on public.sites for all to authenticated using (true) with check (true);
create policy "authenticated read cases" on public.cases for select to authenticated using (true);
create policy "authenticated write cases" on public.cases for all to authenticated using (true) with check (true);
create policy "authenticated read case_inputs" on public.case_inputs for select to authenticated using (true);
create policy "authenticated write case_inputs" on public.case_inputs for all to authenticated using (true) with check (true);
create policy "authenticated read evidence" on public.evidence for select to authenticated using (true);
create policy "authenticated write evidence" on public.evidence for all to authenticated using (true) with check (true);
create policy "authenticated read scenarios" on public.scenarios for select to authenticated using (true);
create policy "authenticated write scenarios" on public.scenarios for all to authenticated using (true) with check (true);
create policy "authenticated read hmb_streams" on public.hmb_streams for select to authenticated using (true);
create policy "authenticated write hmb_streams" on public.hmb_streams for all to authenticated using (true) with check (true);
create policy "authenticated read financial_cases" on public.financial_cases for select to authenticated using (true);
create policy "authenticated write financial_cases" on public.financial_cases for all to authenticated using (true) with check (true);
create policy "authenticated read compliance_gates" on public.compliance_gates for select to authenticated using (true);
create policy "authenticated write compliance_gates" on public.compliance_gates for all to authenticated using (true) with check (true);
create policy "authenticated read proposals" on public.proposals for select to authenticated using (true);
create policy "authenticated write proposals" on public.proposals for all to authenticated using (true) with check (true);
create policy "authenticated read audit_events" on public.audit_events for select to authenticated using (true);
create policy "authenticated write audit_events" on public.audit_events for all to authenticated using (true) with check (true);
