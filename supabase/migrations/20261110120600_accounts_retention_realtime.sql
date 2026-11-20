-- Optional commuter accounts (prepared, not wired), data retention, and Realtime publication.

-- Only for signed-in, NON-anonymous commuters. Guests keep settings and saved trips in
-- LocalStorage; no database rows are created for anonymous settings.
create table public.commuter_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  language text not null default 'en' check (language in ('en', 'fil')),
  appearance text not null default 'system' check (appearance in ('light', 'dark', 'system')),
  text_scale integer not null default 100 check (text_scale in (90, 100, 110, 120, 130)),
  passenger_category public.passenger_category,
  updated_at timestamptz not null default now()
);

create table public.commuter_saved_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_key text not null check (length(client_key) between 1 and 300),
  snapshot jsonb not null check (pg_column_size(snapshot) <= 65536),
  saved_at timestamptz not null default now(),
  unique (user_id, client_key)
);
comment on column public.commuter_saved_trips.snapshot is 'The frontend SavedTrip object (validated client-side by isSavedTrips before use).';

create trigger commuter_preferences_touch before update on public.commuter_preferences
  for each row execute function private.touch_updated_at();

alter table public.commuter_preferences enable row level security;
alter table public.commuter_saved_trips enable row level security;
create policy "account owners manage preferences" on public.commuter_preferences for all to authenticated
  using (user_id = auth.uid() and not private.jwt_is_anonymous())
  with check (user_id = auth.uid() and not private.jwt_is_anonymous());
create policy "account owners manage saved trips" on public.commuter_saved_trips for all to authenticated
  using (user_id = auth.uid() and not private.jwt_is_anonymous())
  with check (user_id = auth.uid() and not private.jwt_is_anonymous());
create function private.limit_saved_trips() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.commuter_saved_trips s where s.user_id = new.user_id) >= 50 then
    raise exception 'saved_trip_limit' using errcode = 'PT429';
  end if;
  return new;
end;
$$;
create trigger commuter_saved_trips_limit before insert on public.commuter_saved_trips
  for each row execute function private.limit_saved_trips();

revoke all on public.commuter_preferences, public.commuter_saved_trips from anon, authenticated;
grant select, insert, update, delete on public.commuter_preferences, public.commuter_saved_trips to authenticated;

-- ---------------------------------------------------------------------------
-- Retention (see docs/BACKEND_SECURITY_PRIVACY.md). Not scheduled automatically:
-- schedule with pg_cron once the team agrees the periods, e.g.
--   select cron.schedule('sakaywise-retention', '17 3 * * *', 'select private.purge_expired_data()');
-- ---------------------------------------------------------------------------
create function private.purge_expired_data(
  p_queue_report_days integer default 30,
  p_closed_support_days integer default 365,
  p_audit_days integer default 730
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  q integer; s integer; a integer;
begin
  delete from public.queue_reports where created_at < now() - make_interval(days => p_queue_report_days);
  get diagnostics q = row_count;
  delete from public.support_conversations
    where status = 'closed' and updated_at < now() - make_interval(days => p_closed_support_days);
  get diagnostics s = row_count;
  delete from public.admin_audit_log where changed_at < now() - make_interval(days => p_audit_days);
  get diagnostics a = row_count;
  return jsonb_build_object('queue_reports', q, 'support_conversations', s, 'audit_rows', a);
end;
$$;
revoke execute on function private.purge_expired_data(integer, integer, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime. postgres_changes respects RLS, so subscribers only receive rows they can select.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.support_messages,
      public.support_conversations,
      public.queue_terminal_signals,
      public.road_advisories;
  end if;
end;
$$;
