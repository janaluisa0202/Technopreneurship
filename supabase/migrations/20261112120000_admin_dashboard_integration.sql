-- Admin dashboard ⇄ commuter app integration.
-- Additive: new tables (profiles, promos, announcements, admin_messages), new RPCs, two widened
-- CHECK constraints, one column on support_conversations and two on admin_audit_log.
-- Existing rows are preserved; every new table has RLS and explicit grants.
-- See docs/ADMIN_INTEGRATION_INVENTORY.md for which admin module uses what.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function private.is_staff() returns boolean
language sql stable set search_path = '' as $$
  select private.has_admin_role(array['admin', 'support_staff', 'transport_data_manager']::public.admin_role[]);
$$;

create function private.manila_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Manila')::date;
$$;

-- Audit log: human-readable detail for explicit events (sign-in, support actions), plus 'EVENT' rows.
alter table public.admin_audit_log add column detail text check (length(detail) <= 300);
alter table public.admin_audit_log drop constraint admin_audit_log_action_check;
alter table public.admin_audit_log add constraint admin_audit_log_action_check check (action in ('INSERT', 'UPDATE', 'DELETE', 'EVENT'));

create function private.log_admin_event(p_table text, p_record text, p_detail text) returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.admin_audit_log (actor_id, table_name, record_id, action, detail)
  values (auth.uid(), p_table, p_record, 'EVENT', left(p_detail, 300));
$$;

-- Staff can record their own sign-in / sign-out in the activity log.
create function public.admin_log_event(p_detail text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_detail not in ('Signed in', 'Signed out') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  perform private.log_admin_event('auth', auth.uid()::text, p_detail);
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user (display name for admins/commuters, admin Users page)
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (length(btrim(display_name)) between 1 and 80),
  email text check (length(email) <= 254),
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
create index profiles_last_seen_idx on public.profiles (last_seen_at desc nulls last);
comment on table public.profiles is 'Minimal account profile. Email is visible only to the owner and SakayWise staff.';

create function private.sync_profile_from_auth() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, display_name, email, is_anonymous, created_at)
  values (new.id,
          nullif(btrim(left(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name', ''), 80)), ''),
          new.email, coalesce(new.is_anonymous, false), coalesce(new.created_at, now()))
  on conflict (user_id) do update
    set email = excluded.email,
        is_anonymous = excluded.is_anonymous,
        display_name = coalesce(public.profiles.display_name, excluded.display_name);
  return new;
end;
$$;
create trigger sakaywise_profile_sync after insert or update of email, is_anonymous, raw_user_meta_data on auth.users
  for each row execute function private.sync_profile_from_auth();

-- Backfill users created before this migration.
insert into public.profiles (user_id, display_name, email, is_anonymous, created_at)
select u.id, nullif(btrim(left(coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'name', ''), 80)), ''),
       u.email, coalesce(u.is_anonymous, false), coalesce(u.created_at, now())
from auth.users u
on conflict (user_id) do nothing;

alter table public.profiles enable row level security;
create policy "owners and staff read profiles" on public.profiles for select to authenticated
  using (user_id = auth.uid() or private.is_staff());
create policy "owners rename themselves" on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Called by the apps after sign-in / session restore. Throttled to one write per 5 minutes.
create function public.touch_profile() returns setof public.profiles
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  insert into public.profiles (user_id, email, is_anonymous)
  select u.id, u.email, coalesce(u.is_anonymous, false) from auth.users u where u.id = auth.uid()
  on conflict (user_id) do nothing;
  update public.profiles p set last_seen_at = now()
    where p.user_id = auth.uid() and (p.last_seen_at is null or p.last_seen_at < now() - interval '5 minutes');
  return query select * from public.profiles p where p.user_id = auth.uid();
end;
$$;

-- Admin Users page: commuter accounts (not staff) with support activity. Staff only.
create function public.admin_list_users(p_query text default null, p_limit integer default 200, p_offset integer default 0)
returns table (user_id uuid, display_name text, email text, is_anonymous boolean, created_at timestamptz,
               last_seen_at timestamptz, conversation_count integer, last_message_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    with convo as (
      select c.owner_id, count(*)::integer as n, max(c.last_message_at) as last_at
      from public.support_conversations c group by c.owner_id
    )
    select p.user_id, p.display_name, p.email, p.is_anonymous, p.created_at, p.last_seen_at,
           coalesce(convo.n, 0), convo.last_at
    from public.profiles p
    left join convo on convo.owner_id = p.user_id
    where not exists (select 1 from public.admin_role_assignments a where a.user_id = p.user_id and a.is_active)
      and (not p.is_anonymous or convo.n > 0)
      and (p_query is null or btrim(p_query) = ''
           or coalesce(p.display_name, '') ilike '%' || btrim(p_query) || '%'
           or coalesce(p.email, '') ilike '%' || btrim(p_query) || '%')
    order by greatest(p.last_seen_at, convo.last_at, p.created_at) desc nulls last
    limit least(greatest(coalesce(p_limit, 200), 1), 500) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Help Center: spam flag, admin unread, activity entries
-- ---------------------------------------------------------------------------
alter table public.support_conversations add column flagged_spam boolean not null default false;

create function public.support_set_spam(p_conversation_id uuid, p_flagged boolean) returns setof public.support_conversations
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.can_support() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query update public.support_conversations c set flagged_spam = coalesce(p_flagged, false)
    where c.id = p_conversation_id returning c.*;
  if not found then
    raise exception 'conversation_not_found' using errcode = '42501';
  end if;
end;
$$;

-- "Mark unread" for staff: clears the read receipt of the newest commuter message.
create function public.support_mark_unread(p_conversation_id uuid) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  changed integer;
begin
  if not private.can_support() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.support_messages m set read_at = null
    where m.id = (select x.id from public.support_messages x
                  where x.conversation_id = p_conversation_id and x.sender_type = 'commuter'
                  order by x.created_at desc, x.id desc limit 1);
  get diagnostics changed = row_count;
  return changed;
end;
$$;

-- Activity entries for staff actions on conversations (no message bodies are copied).
create function private.audit_support_conversation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then
    return null;  -- commuter-side changes (e.g. reopening) are not admin activity
  end if;
  -- Status changes caused by posting a message (open <-> pending) are part of the reply, not a separate action.
  if new.status is distinct from old.status and new.last_message_at is not distinct from old.last_message_at then
    perform private.log_admin_event('support_conversations', new.id::text, 'Marked concern ' || new.status || ' · ' || new.subject);
  end if;
  if new.flagged_spam is distinct from old.flagged_spam then
    perform private.log_admin_event('support_conversations', new.id::text,
      case when new.flagged_spam then 'Flagged conversation as spam' else 'Removed spam flag' end || ' · ' || new.subject);
  end if;
  return null;
end;
$$;
create trigger support_conversations_activity after update on public.support_conversations
  for each row execute function private.audit_support_conversation();

create function private.audit_support_reply() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.sender_type = 'admin' then
    perform private.log_admin_event('support_messages', new.conversation_id::text,
      'Replied to commuter · ' || (select c.subject from public.support_conversations c where c.id = new.conversation_id));
  end if;
  return null;
end;
$$;
create trigger support_messages_activity after insert on public.support_messages
  for each row execute function private.audit_support_reply();

-- ---------------------------------------------------------------------------
-- QueueSense: 'spam' moderation outcome (excluded from estimates like 'rejected')
-- ---------------------------------------------------------------------------
alter table public.queue_reports drop constraint queue_reports_moderation_status_check;
alter table public.queue_reports add constraint queue_reports_moderation_status_check
  check (moderation_status in ('unreviewed', 'approved', 'rejected', 'spam'));

create or replace function public.get_queue_estimates(p_at timestamptz default now())
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
    where r.moderation_status not in ('rejected', 'spam') and r.created_at <= p_at and r.expires_at > p_at
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

-- ---------------------------------------------------------------------------
-- RoadWatch: advisories posted by SakayWise staff ('operator'), distinct from government sources
-- ---------------------------------------------------------------------------
alter table public.road_advisories drop constraint road_advisories_source_type_check;
alter table public.road_advisories add constraint road_advisories_source_type_check
  check (source_type in ('demo', 'official', 'community', 'operator', 'unknown'));

-- ---------------------------------------------------------------------------
-- Promos
-- ---------------------------------------------------------------------------
create table public.promos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 80),
  description text not null check (length(btrim(description)) between 1 and 500),
  promo_type text not null check (promo_type in ('student', 'route-discount', 'partner', 'seasonal')),
  start_date date not null,
  end_date date not null,
  applies_to text not null default '' check (length(applies_to) <= 120),
  status text not null default 'inactive' check (status in ('active', 'inactive')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index promos_window_idx on public.promos (status, end_date);

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 100),
  body text not null check (length(btrim(body)) between 1 and 600),
  channel text not null check (channel in ('para-alerts', 'roadwatch', 'promo', 'general')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  check (status <> 'published' or published_at is not null)
);
create index announcements_feed_idx on public.announcements (status, published_at desc);

create function private.stamp_created_by() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end;
$$;
create function private.stamp_published_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger promos_created_by before insert on public.promos for each row execute function private.stamp_created_by();
create trigger promos_touch before update on public.promos for each row execute function private.touch_updated_at();
create trigger promos_audit after insert or update or delete on public.promos for each row execute function private.audit_row();
create trigger announcements_created_by before insert on public.announcements for each row execute function private.stamp_created_by();
create trigger announcements_published before insert or update on public.announcements for each row execute function private.stamp_published_at();
create trigger announcements_touch before update on public.announcements for each row execute function private.touch_updated_at();
create trigger announcements_audit after insert or update or delete on public.announcements for each row execute function private.audit_row();

alter table public.promos enable row level security;
alter table public.announcements enable row level security;
-- Commuters see only what is live today; staff see drafts, inactive and expired items too.
create policy "public reads current promos" on public.promos for select to anon, authenticated
  using ((status = 'active' and start_date <= private.manila_today() and end_date >= private.manila_today()) or private.is_staff());
create policy "staff insert promos" on public.promos for insert to authenticated with check (private.is_staff());
create policy "staff update promos" on public.promos for update to authenticated using (private.is_staff()) with check (private.is_staff());
create policy "staff delete promos" on public.promos for delete to authenticated using (private.is_staff());
create policy "public reads published announcements" on public.announcements for select to anon, authenticated
  using (status = 'published' or private.is_staff());
create policy "staff insert announcements" on public.announcements for insert to authenticated with check (private.is_staff());
create policy "staff update announcements" on public.announcements for update to authenticated using (private.is_staff()) with check (private.is_staff());
create policy "staff delete announcements" on public.announcements for delete to authenticated using (private.is_staff());
revoke all on public.promos, public.announcements from anon, authenticated;
grant select on public.promos, public.announcements to anon, authenticated;
grant insert, update, delete on public.promos, public.announcements to authenticated;

-- ---------------------------------------------------------------------------
-- Admin messages: one commuter (delivered into their support thread), all users, or a route
-- ---------------------------------------------------------------------------
create table public.admin_messages (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('one', 'all', 'route')),
  recipient_user_id uuid references auth.users (id) on delete set null,
  route_origin_place_id text references public.transport_places (id) on delete set null,
  route_destination_place_id text references public.transport_places (id) on delete set null,
  recipient_label text not null check (length(btrim(recipient_label)) between 1 and 200),
  purpose text not null check (purpose in ('general', 'announcement', 'advisory', 'promo')),
  subject text not null check (length(btrim(subject)) between 1 and 100),
  body text not null check (length(btrim(body)) between 1 and 1000),
  promo_id uuid references public.promos (id) on delete set null,
  conversation_id uuid references public.support_conversations (id) on delete set null,
  sent_by uuid references auth.users (id) on delete set null,
  sent_at timestamptz not null default now(),
  request_id uuid not null,
  unique (sent_by, request_id)
);
create index admin_messages_feed_idx on public.admin_messages (audience, sent_at desc);
comment on table public.admin_messages is 'Staff-sent messages. "one" is also delivered into the recipient''s support thread; "all"/"route" are read by commuters as broadcasts (route matching happens on the device; the server never tracks commuter routes).';

create trigger admin_messages_audit after insert or update or delete on public.admin_messages
  for each row execute function private.audit_row();

alter table public.admin_messages enable row level security;
create policy "staff read all admin messages; commuters read broadcasts" on public.admin_messages for select to authenticated
  using (private.is_staff() or audience in ('all', 'route'));
revoke all on public.admin_messages from anon, authenticated;
grant select on public.admin_messages to authenticated;
-- No INSERT grant: messages are sent through admin_send_message().

-- Delivers a staff message into a commuter's newest open support thread, or starts one.
create function private.deliver_support_message(p_user_id uuid, p_subject text, p_body text, p_request_id uuid)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  convo_id uuid;
  ts timestamptz := now();
begin
  select c.id into convo_id from public.support_conversations c
    where c.owner_id = p_user_id and not c.flagged_spam and c.status <> 'closed'
    order by coalesce(c.last_message_at, c.created_at) desc limit 1;
  if convo_id is null then
    insert into public.support_conversations (owner_id, request_id, category, subject, status, last_message_at)
      values (p_user_id, p_request_id, 'general', left(btrim(p_subject), 120), 'pending', ts)
      returning id into convo_id;
  else
    update public.support_conversations c
      set last_message_at = ts, status = case when c.status = 'open' then 'pending' else c.status end,
          assigned_admin_id = coalesce(c.assigned_admin_id, auth.uid())
      where c.id = convo_id;
  end if;
  insert into public.support_messages (conversation_id, sender_type, sender_id, message, request_id)
    values (convo_id, 'admin', auth.uid(), left(btrim(p_subject) || E'\n\n' || btrim(p_body), 2000), p_request_id)
    on conflict (conversation_id, request_id) do nothing;
  return convo_id;
end;
$$;

create function public.admin_send_message(
  p_audience text,
  p_purpose text,
  p_subject text,
  p_body text,
  p_request_id uuid,
  p_recipient_user_id uuid default null,
  p_route_origin_place_id text default null,
  p_route_destination_place_id text default null,
  p_promo_id uuid default null
) returns setof public.admin_messages
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  label text;
  convo uuid;
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_request_id is null or p_audience not in ('one', 'all', 'route')
     or p_purpose not in ('general', 'announcement', 'advisory', 'promo')
     or length(btrim(coalesce(p_subject, ''))) not between 1 and 100
     or length(btrim(coalesce(p_body, ''))) not between 1 and 1000 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  return query select * from public.admin_messages m where m.sent_by = uid and m.request_id = p_request_id;
  if found then
    return;
  end if;

  if p_purpose = 'promo' and (p_promo_id is null or not exists (select 1 from public.promos p where p.id = p_promo_id)) then
    raise exception 'unknown_promo' using errcode = '22023';
  end if;

  if p_audience = 'one' then
    if not private.can_support() then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    select coalesce(p.display_name, p.email, 'Commuter') into label from public.profiles p
      where p.user_id = p_recipient_user_id
        and not exists (select 1 from public.admin_role_assignments a where a.user_id = p.user_id and a.is_active);
    if label is null then
      raise exception 'unknown_recipient' using errcode = '22023';
    end if;
    convo := private.deliver_support_message(p_recipient_user_id, p_subject, p_body, p_request_id);
  elsif p_audience = 'route' then
    select o.name || ' → ' || d.name into label
      from public.transport_places o, public.transport_places d
      where o.id = p_route_origin_place_id and d.id = p_route_destination_place_id and o.id <> d.id;
    if label is null then
      raise exception 'unknown_route' using errcode = '22023';
    end if;
  else
    label := 'All users';
  end if;

  return query insert into public.admin_messages as m (audience, recipient_user_id, route_origin_place_id, route_destination_place_id,
      recipient_label, purpose, subject, body, promo_id, conversation_id, sent_by, request_id)
    values (p_audience, case when p_audience = 'one' then p_recipient_user_id end,
      case when p_audience = 'route' then p_route_origin_place_id end, case when p_audience = 'route' then p_route_destination_place_id end,
      label, p_purpose, btrim(p_subject), btrim(p_body), case when p_purpose = 'promo' then p_promo_id end, convo, uid, p_request_id)
    returning m.*;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants for new RPCs
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_log_event(text)',
    'public.touch_profile()',
    'public.admin_list_users(text, integer, integer)',
    'public.support_set_spam(uuid, boolean)',
    'public.support_mark_unread(uuid)',
    'public.admin_send_message(text, text, text, text, uuid, uuid, text, text, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
revoke execute on function private.log_admin_event(text, text, text) from public, anon, authenticated;
revoke execute on function private.deliver_support_message(uuid, text, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: admin modules and the commuter Updates feed refresh on change (RLS still applies)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.promos,
      public.announcements,
      public.admin_messages,
      public.queue_reports;
  end if;
end;
$$;
