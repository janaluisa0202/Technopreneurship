-- FareGuard: versioned fare matrices with source, effective period and verification status.
-- Two rule shapes, matching the existing frontend:
--   * segment rules  -> TransportSegment.fares (per passenger, per directed ride segment)
--   * distance rules -> DistanceFareProfile (base for included_km, then per_km_amount), the
--                       separately-labelled sample calculator. Not a legal tariff.
-- A missing passenger category is simply a missing rule. No universal discount is inferred.

create table public.fare_matrices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  matrix_type text not null check (matrix_type in ('segment', 'distance')),
  mode public.transport_mode not null check (mode <> 'walk'),
  service_id text references public.transport_services (id) on delete restrict,
  calculator_mode text check (calculator_mode in ('jeep', 'bus', 'uv')),
  effective_from timestamptz not null,
  effective_to timestamptz,
  source_name text not null check (length(btrim(source_name)) between 1 and 200),
  source_url text check (source_url ~ '^https://[^\s]+$'),
  verification_status text not null default 'pending-review'
    check (verification_status in ('illustrative-sample', 'pending-review', 'verified', 'superseded')),
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  notes text check (length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from),
  check ((matrix_type = 'distance') = (calculator_mode is not null)),
  -- A fare can only be called verified with a citable source and a recorded verifier.
  check (verification_status <> 'verified' or (source_url is not null and verified_at is not null))
);
comment on column public.fare_matrices.verification_status is
  'illustrative-sample = demo numbers (never a legal fare); pending-review = hidden from commuters; verified = validated official tariff; superseded = retired.';

create table public.fare_rules (
  id uuid primary key default gen_random_uuid(),
  fare_matrix_id uuid not null references public.fare_matrices (id) on delete cascade,
  passenger_category public.passenger_category not null,
  segment_id text references public.transport_segments (id) on delete cascade,
  fare_amount numeric(8, 2) not null check (fare_amount >= 0 and fare_amount <= 10000),
  included_km numeric(7, 3) check (included_km >= 0),
  per_km_amount numeric(8, 4) check (per_km_amount >= 0),
  currency char(3) not null default 'PHP' check (currency = 'PHP'),
  created_at timestamptz not null default now(),
  check ((segment_id is null) = (included_km is not null and per_km_amount is not null)),
  unique nulls not distinct (fare_matrix_id, passenger_category, segment_id)
);
create index fare_rules_segment_idx on public.fare_rules (segment_id);

-- Rule shape must match its matrix; a segment rule's segment must be a ride of the matrix mode.
create function private.check_fare_rule() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m public.fare_matrices;
  seg_mode public.transport_mode;
  seg_service text;
begin
  select * into m from public.fare_matrices where id = new.fare_matrix_id;
  if m.matrix_type = 'distance' and new.segment_id is not null then
    raise exception 'distance_matrix_requires_distance_rule' using errcode = '23514';
  end if;
  if m.matrix_type = 'segment' then
    if new.segment_id is null then
      raise exception 'segment_matrix_requires_segment_rule' using errcode = '23514';
    end if;
    select s.mode, s.service_id into seg_mode, seg_service from public.transport_segments s where s.id = new.segment_id;
    if seg_mode = 'walk' then
      raise exception 'walking_segments_have_no_fare' using errcode = '23514';
    end if;
    if seg_mode <> m.mode or (m.service_id is not null and m.service_id is distinct from seg_service) then
      raise exception 'fare_rule_does_not_match_matrix_mode_or_service' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger fare_rules_check before insert or update on public.fare_rules
  for each row execute function private.check_fare_rule();

create function private.stamp_fare_verification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.verification_status = 'verified'
     and (tg_op = 'INSERT' or old.verification_status is distinct from 'verified') then
    new.verified_by := coalesce(auth.uid(), new.verified_by);
    new.verified_at := now();
  elsif new.verification_status <> 'verified' then
    new.verified_by := null;
    new.verified_at := null;
  end if;
  return new;
end;
$$;
create trigger fare_matrices_verification before insert or update on public.fare_matrices
  for each row execute function private.stamp_fare_verification();
create trigger fare_matrices_touch before update on public.fare_matrices
  for each row execute function private.touch_updated_at();
create trigger fare_matrices_audit after insert or update or delete on public.fare_matrices
  for each row execute function private.audit_row();
create trigger fare_rules_audit after insert or update or delete on public.fare_rules
  for each row execute function private.audit_row();

alter table public.fare_matrices enable row level security;
alter table public.fare_rules enable row level security;

create policy "public reads published matrices" on public.fare_matrices for select to anon, authenticated
  using (verification_status in ('illustrative-sample', 'verified') or private.can_manage_transport());
create policy "transport managers insert matrices" on public.fare_matrices for insert to authenticated
  with check (private.can_manage_transport());
create policy "transport managers update matrices" on public.fare_matrices for update to authenticated
  using (private.can_manage_transport()) with check (private.can_manage_transport());
create policy "transport managers delete matrices" on public.fare_matrices for delete to authenticated
  using (private.can_manage_transport());

create policy "public reads rules of published matrices" on public.fare_rules for select to anon, authenticated
  using (exists (select 1 from public.fare_matrices m where m.id = fare_matrix_id));
create policy "transport managers insert rules" on public.fare_rules for insert to authenticated
  with check (private.can_manage_transport());
create policy "transport managers update rules" on public.fare_rules for update to authenticated
  using (private.can_manage_transport()) with check (private.can_manage_transport());
create policy "transport managers delete rules" on public.fare_rules for delete to authenticated
  using (private.can_manage_transport());

revoke all on public.fare_matrices, public.fare_rules from anon, authenticated;
grant select on public.fare_matrices, public.fare_rules to anon, authenticated;
grant insert, update, delete on public.fare_matrices, public.fare_rules to authenticated;

-- Applicable rules at a point in time. For each target (a segment, or a calculator mode)
-- exactly ONE matrix is chosen: verified beats sample, then the latest effective_from.
-- All rules come from that one matrix, so a verified regular fare is never silently
-- combined with a sample student fare. Missing categories stay missing.
create function public.get_current_fare_rules(p_at timestamptz default now())
returns table (
  rule_id uuid,
  fare_matrix_id uuid,
  matrix_type text,
  mode public.transport_mode,
  calculator_mode text,
  segment_id text,
  passenger_category public.passenger_category,
  fare_amount numeric,
  included_km numeric,
  per_km_amount numeric,
  verification_status text,
  source_name text,
  source_url text,
  effective_from timestamptz,
  effective_to timestamptz
)
language sql stable security invoker set search_path = '' as $$
  with eligible as (
    select r.*, m.matrix_type, m.mode, m.calculator_mode, m.verification_status, m.source_name, m.source_url,
           m.effective_from, m.effective_to,
           coalesce(r.segment_id, 'calc:' || m.calculator_mode) as target
    from public.fare_rules r
    join public.fare_matrices m on m.id = r.fare_matrix_id
    where m.verification_status in ('illustrative-sample', 'verified')
      and m.effective_from <= p_at
      and (m.effective_to is null or m.effective_to > p_at)
  ), chosen as (
    select distinct on (target) target, fare_matrix_id
    from eligible
    order by target, (verification_status = 'verified') desc, effective_from desc, fare_matrix_id
  )
  select e.id, e.fare_matrix_id, e.matrix_type, e.mode, e.calculator_mode, e.segment_id, e.passenger_category,
         e.fare_amount, e.included_km, e.per_km_amount, e.verification_status, e.source_name, e.source_url,
         e.effective_from, e.effective_to
  from eligible e
  join chosen c on c.target = e.target and c.fare_matrix_id = e.fare_matrix_id
  order by e.target, e.passenger_category;
$$;
grant execute on function public.get_current_fare_rules(timestamptz) to anon, authenticated;
