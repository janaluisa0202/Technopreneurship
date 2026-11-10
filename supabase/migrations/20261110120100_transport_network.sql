-- Transport network: places, stops (graph nodes), services, directed segments, queue terminals.
-- IDs are stable text identifiers shared with the frontend route engine (lib/routeEngine.ts).
-- Every row states its provenance. Demo seed rows are 'illustrative-demo' and must stay labelled.
-- No geometry is stored: no verified geometry exists yet and none may be fabricated.

create table public.transport_places (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  name text not null check (length(btrim(name)) between 1 and 160),
  formatted_address text not null check (length(btrim(formatted_address)) between 1 and 300),
  street text check (length(street) <= 160),
  building text check (length(building) <= 160),
  barangay text check (length(barangay) <= 120),
  city text check (length(city) <= 120),
  landmark text check (length(landmark) <= 160),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  coordinates_verified boolean not null default false,
  provenance public.data_provenance not null,
  is_active boolean not null default true,
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null)),
  check (not coordinates_verified or latitude is not null)
);
comment on table public.transport_places is 'Searchable commuter places (frontend Place). Manual addresses are never stored here.';

-- Graph nodes. A place endpoint node MUST use the place id as its own id: the engine
-- starts traversal at node id = selected Place.id (see docs/BACKEND_HANDOFF.md).
create table public.transport_stops (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  name text not null check (length(btrim(name)) between 1 and 160),
  place_id text references public.transport_places (id) on delete restrict,
  area_id text not null check (area_id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  stop_type text not null check (stop_type in ('place-endpoint', 'boarding-area', 'platform', 'drop-off', 'transfer-point', 'local-stop')),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  coordinates_verified boolean not null default false,
  provenance public.data_provenance not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (place_id is null or place_id = id),
  check ((stop_type = 'place-endpoint') = (place_id is not null)),
  check ((latitude is null) = (longitude is null))
);

-- A vehicle service (the prompt's "transport_routes"). Named "service" because a frontend
-- "route" is a computed itinerary. id = TransportSegment.serviceId, e.g. 'srv:ust-north-jeep'.
create table public.transport_services (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9:-]{1,99}$'),
  name text not null check (length(btrim(name)) between 1 and 160),
  mode public.transport_mode not null check (mode <> 'walk'),
  operator_name text check (length(operator_name) <= 160),
  provenance public.data_provenance not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, mode)
);

create table public.queue_terminals (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  name text not null unique check (length(btrim(name)) between 1 and 120),
  place_id text references public.transport_places (id) on delete set null,
  is_reportable boolean not null default true,
  sort_order integer not null default 1000,
  provenance public.data_provenance not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.queue_terminals.is_reportable is 'Listed as a choice in the commuter report form. Any active terminal on the network accepts reports.';

-- Directed connections. No reverse edge is ever inferred.
create table public.transport_segments (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,99}$'),
  from_stop_id text not null references public.transport_stops (id) on delete restrict,
  to_stop_id text not null references public.transport_stops (id) on delete restrict,
  mode public.transport_mode not null,
  service_id text,
  signboard text not null check (length(btrim(signboard)) between 1 and 200),
  instruction text not null check (length(btrim(instruction)) between 1 and 500),
  travel_minutes numeric(6, 2) not null check (travel_minutes >= 0 and travel_minutes <= 600),
  transfer_minutes numeric(6, 2) not null default 0 check (transfer_minutes >= 0 and transfer_minutes <= 120),
  boarding_wait_minutes numeric(6, 2) not null default 0 check (boarding_wait_minutes >= 0 and boarding_wait_minutes <= 120),
  distance_km numeric(7, 3) check (distance_km > 0),
  queue_terminal_id text references public.queue_terminals (id) on delete restrict,
  queue_default_level public.queue_level,
  queue_low_minutes numeric(6, 2) check (queue_low_minutes >= 0),
  queue_mid_minutes numeric(6, 2) check (queue_mid_minutes >= 0),
  queue_high_minutes numeric(6, 2) check (queue_high_minutes >= 0),
  provenance public.data_provenance not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (service_id, mode) references public.transport_services (id, mode) on delete restrict,
  check (from_stop_id <> to_stop_id),
  check ((mode = 'walk') = (service_id is null)),
  check (mode <> 'walk' or (queue_terminal_id is null and transfer_minutes = 0 and boarding_wait_minutes = 0)),
  check (num_nulls(queue_terminal_id, queue_default_level, queue_low_minutes, queue_mid_minutes, queue_high_minutes) in (0, 5)),
  check (queue_low_minutes is null or (queue_low_minutes <= queue_mid_minutes and queue_mid_minutes <= queue_high_minutes))
);
create index transport_segments_from_idx on public.transport_segments (from_stop_id) where is_active;
create index transport_segments_service_idx on public.transport_segments (service_id);
create index transport_segments_terminal_idx on public.transport_segments (queue_terminal_id);
create index transport_stops_place_idx on public.transport_stops (place_id);

create table public.popular_journeys (
  id bigint generated always as identity primary key,
  origin_place_id text not null references public.transport_places (id) on delete cascade,
  destination_place_id text not null references public.transport_places (id) on delete cascade,
  sort_order integer not null default 1000,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (origin_place_id <> destination_place_id),
  unique (origin_place_id, destination_place_id)
);

-- updated_at + audit + RLS for every network table.
do $$
declare
  t text;
begin
  foreach t in array array['transport_places', 'transport_stops', 'transport_services', 'queue_terminals', 'transport_segments'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.touch_updated_at()', t || '_touch', t);
  end loop;
  foreach t in array array['transport_places', 'transport_stops', 'transport_services', 'queue_terminals', 'transport_segments', 'popular_journeys'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()', t || '_audit', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public reads active rows" on public.%I for select to anon, authenticated using (is_active or private.can_manage_transport())', t);
    execute format('create policy "transport managers insert" on public.%I for insert to authenticated with check (private.can_manage_transport())', t);
    execute format('create policy "transport managers update" on public.%I for update to authenticated using (private.can_manage_transport()) with check (private.can_manage_transport())', t);
    execute format('create policy "transport managers delete" on public.%I for delete to authenticated using (private.can_manage_transport())', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;
