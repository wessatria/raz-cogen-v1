insert into storage.buckets (id, name, public)
values ('case-evidence', 'case-evidence', false)
on conflict (id) do nothing;

alter table public.evidence
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint;
