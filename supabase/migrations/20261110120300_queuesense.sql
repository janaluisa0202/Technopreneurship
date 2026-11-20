-- QueueSense: community queue reports -> moderated, expiring, aggregated estimates.
-- * Raw reports are private (reporter + moderators). The public sees aggregates only.
-- * Server controls identity, timestamps, expiry and moderation state; the client cannot.
-- * One community vote per reporter per terminal; reports expire after 30 minutes.
-- * 'terminal-staff' reports are entered by authorised staff and are the only
--   source treated as verified terminal data.

create table public.queue_reports (
  id uuid primary key default gen_random_uuid(),
  terminal_id text not null references public.queue_terminals (id) on delete restrict,
  segment_id text references public.transport_segments (id) on delete set null,
  reporter_id uuid references auth.users (id) on delete set null,
  request_id uuid not null,
  queue_level public.queue_level not null,
  estimated_wait_minutes integer check (estimated_wait_minutes between 0 and 240),
  details text check (length(details) <= 150),
  report_source text not null default 'community' check (report_source in ('community', 'terminal-staff')),
  moderation_status text not null default 'unreviewed' check (moderation_status in ('unreviewed', 'approved', 'rejected')),
  moderation_note text check (length(moderation_note) <= 500),
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (reporter_id, request_id),
  check (expires_at > created_at)
);
create index queue_reports_terminal_window_idx on public.queue_reports (terminal_id, expires_at desc);
create index queue_reports_reporter_time_idx on public.queue_reports (reporter_id, created_at desc);
create index queue_reports_moderation_idx on public.queue_reports (moderation_status, created_at desc);

-- Lightweight public change signal for Realtime (no personal data). Clients refetch estimates.
create table public.queue_terminal_signals (
  terminal_id text primary key references public.queue_terminals (id) on delete cascade,
  changed_at timestamptz not null default now()
);

create function private.signal_queue_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.queue_terminal_signals (terminal_id, changed_at)
  values (new.terminal_id, now())
  on conflict (terminal_id) do update set changed_at = excluded.changed_at;
  return null;
end;
$$;
create trigger queue_reports_signal after insert or update on public.queue_reports
  for each row execute function private.signal_queue_change();

create function private.stamp_queue_moderation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.moderation_status is distinct from old.moderation_status or new.moderation_note is distinct from old.moderation_note then
    new.moderated_by := auth.uid();
    new.moderated_at := now();
  end if;
  return new;
end;
$$;
create trigger queue_reports_moderation before update on public.queue_reports
  for each row execute function private.stamp_queue_moderation();
create trigger queue_reports_audit after update or delete on public.queue_reports
  for each row execute function private.audit_row();

alter table public.queue_reports enable row level security;
alter table public.queue_terminal_signals enable row level security;
create policy "reporters read own reports; moderators read all" on public.queue_reports
  for select to authenticated using (reporter_id = auth.uid() or private.can_manage_transport());
create policy "moderators moderate" on public.queue_reports
  for update to authenticated using (private.can_manage_transport()) with check (private.can_manage_transport());
create policy "moderators delete" on public.queue_reports
  for delete to authenticated using (private.can_manage_transport());
create policy "public reads change signals" on public.queue_terminal_signals
  for select to anon, authenticated using (true);

revoke all on public.queue_reports, public.queue_terminal_signals from anon, authenticated;
grant select, delete on public.queue_reports to authenticated;
grant update (moderation_status, moderation_note) on public.queue_reports to authenticated;
grant select on public.queue_terminal_signals to anon, authenticated;
-- No INSERT grant: submissions go through submit_queue_report() only.

create function public.submit_queue_report(
  p_terminal_id text,
  p_queue_level public.queue_level,
  p_request_id uuid,
  p_details text default null,
  p_segment_id text default null,
  p_estimated_wait_minutes integer default null,
  p_report_source text default 'community'
)
returns table (id uuid, terminal_id text, queue_level public.queue_level, report_source text,
               moderation_status text, created_at timestamptz, expires_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  clean_details text := nullif(btrim(coalesce(p_details, '')), '');
  recent_total integer;
  recent_terminal integer;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_request_id is null or p_queue_level is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_report_source not in ('community', 'terminal-staff') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_report_source = 'terminal-staff' and not private.can_manage_transport() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if clean_details is not null and length(clean_details) > 150 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  -- Serialise this reporter's submissions so rate limits cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 42));

  -- Idempotent retry: the same request id returns the original report.
  return query
    select r.id, r.terminal_id, r.queue_level, r.report_source, r.moderation_status, r.created_at, r.expires_at
    from public.queue_reports r where r.reporter_id = uid and r.request_id = p_request_id;
  if found then
    return;
  end if;

  if not exists (select 1 from public.queue_terminals t where t.id = p_terminal_id and t.is_active) then
    raise exception 'unknown_terminal' using errcode = '22023';
  end if;
  if p_segment_id is not null and not exists (
    select 1 from public.transport_segments s where s.id = p_segment_id and s.queue_terminal_id = p_terminal_id and s.is_active) then
    raise exception 'segment_not_at_terminal' using errcode = '22023';
  end if;

  if p_report_source = 'community' then
    select count(*) into recent_total from public.queue_reports r
      where r.reporter_id = uid and r.created_at > now() - interval '10 minutes';
    if recent_total >= 6 then
      raise exception 'rate_limited' using errcode = 'PT429';
    end if;
    select count(*) into recent_terminal from public.queue_reports r
      where r.reporter_id = uid and r.terminal_id = p_terminal_id and r.created_at > now() - interval '3 minutes';
    if recent_terminal >= 1 then
      raise exception 'duplicate_report' using errcode = 'PT429';
    end if;
  end if;

  return query
    insert into public.queue_reports as r (terminal_id, segment_id, reporter_id, request_id, queue_level,
      estimated_wait_minutes, details, report_source, moderation_status, created_at, expires_at)
    values (p_terminal_id, p_segment_id, uid, p_request_id, p_queue_level, p_estimated_wait_minutes, clean_details,
      p_report_source, case when p_report_source = 'terminal-staff' then 'approved' else 'unreviewed' end,
      now(), now() + interval '30 minutes')
    returning r.id, r.terminal_id, r.queue_level, r.report_source, r.moderation_status, r.created_at, r.expires_at;
end;
$$;
revoke execute on function public.submit_queue_report(text, public.queue_level, uuid, text, text, integer, text) from public, anon;
grant execute on function public.submit_queue_report(text, public.queue_level, uuid, text, text, integer, text) to authenticated;

-- Aggregated estimate per active terminal. Never exposes reporters or free text.
--   source      none | community | terminal-staff
--   confidence  none | low | medium | high   (community confidence grows with independent agreeing reporters)
--   queue_level upper median of independent community votes (warns rather than under-reports)
create function public.get_queue_estimates(p_at timestamptz default now())
returns table (
  terminal_id text,
  terminal_name text,
  place_id text,
  is_reportable boolean,
  sort_order integer,
  queue_level public.queue_level,
  source text,
  confidence text,
  sample_count integer,
  latest_reported_at timestamptz,
  next_change_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  with eligible as (
    select r.*, case r.queue_level when 'low' then 1 when 'mid' then 2 else 3 end as ord
    from public.queue_reports r
    where r.moderation_status <> 'rejected' and r.created_at <= p_at and r.expires_at > p_at
  ), staff as (
    select distinct on (e.terminal_id) e.terminal_id, e.queue_level, e.created_at, e.expires_at
    from eligible e where e.report_source = 'terminal-staff'
    order by e.terminal_id, e.created_at desc
  ), votes as (
    select distinct on (e.terminal_id, e.reporter_id) e.terminal_id, e.ord, e.created_at, e.expires_at
    from eligible e where e.report_source = 'community' and e.reporter_id is not null
    order by e.terminal_id, e.reporter_id, e.created_at desc
  ), community as (
    select v.terminal_id, count(*)::integer as n,
           percentile_disc(0.5) within group (order by v.ord desc) as med,
           max(v.ord) - min(v.ord) as spread,
           max(v.created_at) as latest, min(v.expires_at) as next_expiry
    from votes v group by v.terminal_id
  ), agreement as (
    select v.terminal_id, count(*)::numeric / c.n as share
    from votes v join community c on c.terminal_id = v.terminal_id and v.ord = c.med
    group by v.terminal_id, c.n
  )
  select t.id, t.name, t.place_id, t.is_reportable, t.sort_order,
    coalesce(s.queue_level, (array['low', 'mid', 'high']::public.queue_level[])[c.med]),
    case when s.terminal_id is not null then 'terminal-staff' when c.terminal_id is not null then 'community' else 'none' end,
    case
      when s.terminal_id is not null then 'high'
      when c.terminal_id is null then 'none'
      when c.n = 1 then 'low'
      when c.n <= 3 then case when c.spread <= 1 then 'medium' else 'low' end
      when a.share >= 0.6 then 'high'
      else 'medium'
    end,
    coalesce(c.n, 0) + case when s.terminal_id is not null then 1 else 0 end,
    greatest(s.created_at, c.latest),
    least(s.expires_at, c.next_expiry)
  from public.queue_terminals t
  left join staff s on s.terminal_id = t.id
  left join community c on c.terminal_id = t.id
  left join agreement a on a.terminal_id = t.id
  where t.is_active
  order by t.sort_order, t.name;
$$;
grant execute on function public.get_queue_estimates(timestamptz) to anon, authenticated;
