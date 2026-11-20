-- Commuter <-> admin support messaging.
-- Guests use Supabase Anonymous Sign-Ins: a real, server-issued JWT whose auth.uid() owns the
-- conversation. A client-generated UUID is never accepted as identity. The prompt's
-- "commuter_user_id" and "guest_access_identity" are therefore one column: owner_id.
-- All writes go through the RPCs below; there are no INSERT/UPDATE grants on these tables.

create table public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null,
  category text not null check (category in ('route', 'fare', 'roadwatch', 'queue', 'bug', 'general', 'other')),
  subject text not null check (length(btrim(subject)) between 1 and 120),
  status text not null default 'open' check (status in ('open', 'pending', 'resolved', 'closed')),
  nickname text check (length(nickname) <= 80),
  contact_email text check (length(contact_email) <= 254 and contact_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  related_trip text check (length(related_trip) <= 200),
  assigned_admin_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  unique (owner_id, request_id)
);
comment on column public.support_conversations.status is 'open = awaiting support, pending = awaiting commuter, resolved = answered (commuter reply reopens), closed = final.';
create index support_conversations_owner_idx on public.support_conversations (owner_id, updated_at desc);
create index support_conversations_inbox_idx on public.support_conversations (status, last_message_at desc nulls last);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations (id) on delete cascade,
  sender_type text not null check (sender_type in ('commuter', 'admin', 'system')),
  sender_id uuid references auth.users (id) on delete set null,
  message text not null check (length(btrim(message)) between 1 and 2000),
  request_id uuid not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (conversation_id, request_id)
);
create index support_messages_conversation_idx on public.support_messages (conversation_id, created_at, id);
create index support_messages_sender_time_idx on public.support_messages (sender_id, created_at desc);

create trigger support_conversations_touch before update on public.support_conversations
  for each row execute function private.touch_updated_at();

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

create policy "owners and support staff read conversations" on public.support_conversations
  for select to authenticated using (owner_id = auth.uid() or private.can_support());
create policy "owners and support staff read messages" on public.support_messages
  for select to authenticated using (
    private.can_support()
    or exists (select 1 from public.support_conversations c where c.id = conversation_id and c.owner_id = auth.uid())
  );

revoke all on public.support_conversations, public.support_messages from anon, authenticated;
grant select on public.support_conversations, public.support_messages to authenticated;

create function private.support_subject(p_category text) returns text
language sql immutable set search_path = '' as $$
  select case p_category
    when 'route' then 'Route problems' when 'fare' then 'Incorrect fares' when 'roadwatch' then 'RoadWatch advisories'
    when 'queue' then 'Queue reports' when 'bug' then 'Application bugs' when 'general' then 'General questions'
    when 'other' then 'Other concerns' end;
$$;

create function private.clean_optional(p_value text, p_max integer) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := nullif(btrim(coalesce(p_value, '')), '');
begin
  if v is not null and length(v) > p_max then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  return v;
end;
$$;

create function public.support_create_conversation(
  p_category text,
  p_request_id uuid,
  p_nickname text default null,
  p_contact_email text default null,
  p_related_trip text default null
) returns setof public.support_conversations
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  email text := private.clean_optional(p_contact_email, 254);
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_request_id is null or private.support_subject(p_category) is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if email is not null and email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 7));

  return query select * from public.support_conversations c where c.owner_id = uid and c.request_id = p_request_id;
  if found then
    return;
  end if;
  if (select count(*) from public.support_conversations c where c.owner_id = uid and c.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;
  if (select count(*) from public.support_conversations c where c.owner_id = uid and c.status in ('open', 'pending')) >= 20 then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;

  return query insert into public.support_conversations (owner_id, request_id, category, subject, nickname, contact_email, related_trip)
    values (uid, p_request_id, p_category, private.support_subject(p_category),
            private.clean_optional(p_nickname, 80), email, private.clean_optional(p_related_trip, 200))
    returning *;
end;
$$;

create function public.support_update_conversation(
  p_conversation_id uuid,
  p_category text,
  p_nickname text default null,
  p_contact_email text default null,
  p_related_trip text default null
) returns setof public.support_conversations
language plpgsql volatile security definer set search_path = '' as $$
declare
  email text := private.clean_optional(p_contact_email, 254);
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if private.support_subject(p_category) is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if email is not null and email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  return query update public.support_conversations c
    set category = p_category, subject = private.support_subject(p_category),
        nickname = private.clean_optional(p_nickname, 80), contact_email = email,
        related_trip = private.clean_optional(p_related_trip, 200)
    where c.id = p_conversation_id and c.owner_id = auth.uid() and c.status <> 'closed'
    returning c.*;
  if not found then
    raise exception 'conversation_not_found' using errcode = '42501';
  end if;
end;
$$;

-- Commuters send as 'commuter' in their own conversations; support staff send as 'admin'.
-- The sender type is derived on the server, never taken from the client.
create function public.support_send_message(
  p_conversation_id uuid,
  p_message text,
  p_request_id uuid
) returns setof public.support_messages
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  convo public.support_conversations;
  sender text;
  body text := btrim(coalesce(p_message, ''));
  last_body text;
  last_time timestamptz;
begin
  if uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if body = '' then
    raise exception 'empty_message' using errcode = '22023';
  end if;
  if length(body) > 2000 then
    raise exception 'message_too_long' using errcode = '22023';
  end if;

  select * into convo from public.support_conversations c where c.id = p_conversation_id for update;
  if not found then
    raise exception 'conversation_not_found' using errcode = '42501';
  end if;
  if convo.owner_id = uid then
    sender := 'commuter';
  elsif private.can_support() then
    sender := 'admin';
  else
    -- Same error as "missing" so other people's conversation ids cannot be probed.
    raise exception 'conversation_not_found' using errcode = '42501';
  end if;

  return query select * from public.support_messages m where m.conversation_id = p_conversation_id and m.request_id = p_request_id;
  if found then
    return;
  end if;

  if convo.status = 'closed' then
    raise exception 'conversation_closed' using errcode = '22023';
  end if;
  if sender = 'commuter' then
    if (select count(*) from public.support_messages m where m.conversation_id = p_conversation_id and m.sender_type = 'commuter') >= 100 then
      raise exception 'conversation_limit' using errcode = 'PT429';
    end if;
    if (select count(*) from public.support_messages m where m.sender_id = uid and m.created_at > now() - interval '1 minute') >= 10 then
      raise exception 'rate_limited' using errcode = 'PT429';
    end if;
    select m.message, m.created_at into last_body, last_time from public.support_messages m
      where m.conversation_id = p_conversation_id and m.sender_id = uid order by m.created_at desc, m.id desc limit 1;
    if last_body = body and last_time > now() - interval '5 seconds' then
      raise exception 'duplicate_message' using errcode = 'PT429';
    end if;
  end if;

  update public.support_conversations c
    set last_message_at = now(),
        status = case
          when sender = 'commuter' then 'open'
          when sender = 'admin' and c.status = 'open' then 'pending'
          else c.status end,
        assigned_admin_id = case when sender = 'admin' and c.assigned_admin_id is null then uid else c.assigned_admin_id end
    where c.id = p_conversation_id;

  return query insert into public.support_messages (conversation_id, sender_type, sender_id, message, request_id)
    values (p_conversation_id, sender, uid, body, p_request_id)
    returning *;
end;
$$;

-- Marks messages from the *other* side as read. Real read receipts only.
create function public.support_mark_read(p_conversation_id uuid) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  convo public.support_conversations;
  changed integer;
begin
  select * into convo from public.support_conversations c where c.id = p_conversation_id;
  if not found or auth.uid() is null then
    raise exception 'conversation_not_found' using errcode = '42501';
  end if;
  if convo.owner_id = auth.uid() then
    update public.support_messages m set read_at = now()
      where m.conversation_id = p_conversation_id and m.read_at is null and m.sender_type in ('admin', 'system');
  elsif private.can_support() then
    update public.support_messages m set read_at = now()
      where m.conversation_id = p_conversation_id and m.read_at is null and m.sender_type = 'commuter';
  else
    raise exception 'conversation_not_found' using errcode = '42501';
  end if;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

create function public.support_set_status(p_conversation_id uuid, p_status text) returns setof public.support_conversations
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.can_support() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('open', 'pending', 'resolved', 'closed') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  return query update public.support_conversations c set status = p_status where c.id = p_conversation_id returning c.*;
  if not found then
    raise exception 'conversation_not_found' using errcode = '42501';
  end if;
end;
$$;

create function public.support_assign(p_conversation_id uuid, p_admin_id uuid) returns setof public.support_conversations
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.can_support() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_admin_id is not null and not exists (
    select 1 from public.admin_role_assignments a where a.user_id = p_admin_id and a.is_active
      and a.role in ('super_admin', 'admin', 'support_staff')) then
    raise exception 'assignee_not_support_staff' using errcode = '22023';
  end if;
  return query update public.support_conversations c set assigned_admin_id = p_admin_id where c.id = p_conversation_id returning c.*;
  if not found then
    raise exception 'conversation_not_found' using errcode = '42501';
  end if;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.support_create_conversation(text, uuid, text, text, text)',
    'public.support_update_conversation(uuid, text, text, text, text)',
    'public.support_send_message(uuid, text, uuid)',
    'public.support_mark_read(uuid)',
    'public.support_set_status(uuid, text)',
    'public.support_assign(uuid, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
