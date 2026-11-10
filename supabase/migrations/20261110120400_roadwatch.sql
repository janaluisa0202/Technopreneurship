-- RoadWatch: advisories with mandatory source attribution and explicit impact mappings.
-- Mirrors the frontend RoadAdvisory model (types/roadwatch.ts). Effective status, staleness and
-- routing effects are still evaluated by the single client implementation (lib/roadwatchService.ts,
-- lib/advisoryImpact.ts) so there is one source of truth for "does this affect my route".
-- Impacts are explicit typed references; nothing is inferred from similar text.

create table public.road_advisories (
  id text primary key default ('rw-' || replace(gen_random_uuid()::text, '-', ''))
    check (id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  incident_id text check (length(btrim(incident_id)) between 1 and 80),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null check (length(btrim(description)) between 1 and 2000),
  category text not null check (category in ('traffic', 'closure', 'flooding', 'transport', 'roadworks')),
  severity text not null check (severity in ('low', 'moderate', 'high', 'critical')),
  status text not null check (status in ('active', 'scheduled', 'resolved', 'expired', 'unknown')),
  source_type text not null check (source_type in ('demo', 'official', 'community', 'unknown')),
  source_name text not null check (length(btrim(source_name)) between 1 and 200),
  source_url text check (source_url ~ '^https://[^\s]+$'),
  external_ref text check (length(external_ref) <= 200),
  verification_status text not null check (verification_status in ('simulated', 'verified', 'unverified')),
  area_name text not null check (length(btrim(area_name)) between 1 and 200),
  impact_type text not null check (impact_type in ('informational', 'delay', 'service-interruption', 'segment-closure', 'unknown')),
  effect_confirmed boolean not null default false,
  estimated_delay_minutes numeric(6, 1) check (estimated_delay_minutes >= 0 and estimated_delay_minutes <= 600),
  delay_basis text check (delay_basis in ('additional-travel', 'queue-overlap', 'unknown')),
  delay_evidence text check (delay_evidence in ('simulation', 'source-estimate')),
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  suggested_action text check (length(suggested_action) <= 500),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  geometry_verified boolean not null default false,
  is_published boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (status <> 'scheduled' or starts_at is not null),
  check (updated_at >= published_at),
  -- Demo records are always simulated, and only demo records may be simulated.
  check ((source_type = 'demo') = (verification_status = 'simulated')),
  -- "Verified" requires an official, citable source.
  check (verification_status <> 'verified' or (source_type = 'official' and source_url is not null)),
  check (delay_evidence is distinct from 'simulation' or source_type = 'demo'),
  check (delay_evidence is distinct from 'source-estimate' or source_type <> 'demo'),
  check ((latitude is null) = (longitude is null)),
  unique (source_name, external_ref)
);
comment on column public.road_advisories.external_ref is 'Identifier from an authorised upstream feed; lets a provider adapter upsert idempotently.';
create index road_advisories_feed_idx on public.road_advisories (is_published, updated_at desc);

create table public.road_advisory_impacts (
  id uuid primary key default gen_random_uuid(),
  advisory_id text not null references public.road_advisories (id) on delete cascade,
  target_type text not null check (target_type in ('segment', 'stop', 'service', 'itinerary')),
  segment_id text references public.transport_segments (id) on delete cascade,
  stop_id text references public.transport_stops (id) on delete cascade,
  service_id text references public.transport_services (id) on delete cascade,
  itinerary_id text check (length(itinerary_id) between 1 and 1100),
  created_at timestamptz not null default now(),
  check (num_nonnulls(segment_id, stop_id, service_id, itinerary_id) = 1),
  check ((target_type = 'segment') = (segment_id is not null)),
  check ((target_type = 'stop') = (stop_id is not null)),
  check ((target_type = 'service') = (service_id is not null)),
  check ((target_type = 'itinerary') = (itinerary_id is not null)),
  unique nulls not distinct (advisory_id, segment_id, stop_id, service_id, itinerary_id)
);
create index road_advisory_impacts_advisory_idx on public.road_advisory_impacts (advisory_id);

create function private.stamp_advisory() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  elsif tg_op = 'UPDATE' and (to_jsonb(new) - 'updated_at' - 'is_published') is distinct from (to_jsonb(old) - 'updated_at' - 'is_published')
        and new.updated_at is not distinct from old.updated_at then
    -- Content changed without an explicit source update time: record the edit time.
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger road_advisories_stamp before insert or update on public.road_advisories
  for each row execute function private.stamp_advisory();
create trigger road_advisories_audit after insert or update or delete on public.road_advisories
  for each row execute function private.audit_row();
create trigger road_advisory_impacts_audit after insert or update or delete on public.road_advisory_impacts
  for each row execute function private.audit_row();

alter table public.road_advisories enable row level security;
alter table public.road_advisory_impacts enable row level security;

create policy "public reads published advisories" on public.road_advisories for select to anon, authenticated
  using (is_published or private.can_manage_transport());
create policy "managers insert advisories" on public.road_advisories for insert to authenticated
  with check (private.can_manage_transport());
create policy "managers update advisories" on public.road_advisories for update to authenticated
  using (private.can_manage_transport()) with check (private.can_manage_transport());
create policy "managers delete advisories" on public.road_advisories for delete to authenticated
  using (private.can_manage_transport());

-- The parent's RLS applies inside the subquery, so unpublished impacts stay hidden.
create policy "public reads impacts of visible advisories" on public.road_advisory_impacts for select to anon, authenticated
  using (exists (select 1 from public.road_advisories a where a.id = advisory_id));
create policy "managers insert impacts" on public.road_advisory_impacts for insert to authenticated
  with check (private.can_manage_transport());
create policy "managers update impacts" on public.road_advisory_impacts for update to authenticated
  using (private.can_manage_transport()) with check (private.can_manage_transport());
create policy "managers delete impacts" on public.road_advisory_impacts for delete to authenticated
  using (private.can_manage_transport());

revoke all on public.road_advisories, public.road_advisory_impacts from anon, authenticated;
grant select on public.road_advisories, public.road_advisory_impacts to anon, authenticated;
grant insert, update, delete on public.road_advisories, public.road_advisory_impacts to authenticated;
