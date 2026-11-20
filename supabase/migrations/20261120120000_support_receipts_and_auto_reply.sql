-- Support messaging: honest seen receipts + automated reply with alternative contact channels.
-- Additive: one column, two tables (+RLS), one trigger; support_mark_read/support_mark_unread are
-- replaced with the same signatures. Existing rows are kept.
--
-- 1. Seen receipts. support_messages.created_at ("Sent") and read_at ("Seen") are set by the server.
--    Until now the admin "Mark unread" action cleared the commuter message's read_at, which would make a
--    commuter-visible "Seen" disappear. The admin inbox state is now a separate flag (staff_unread), and
--    read receipts are only ever set, never cleared.
-- 2. Automated reply. When a commuter writes and neither staff nor the auto-reply has answered in that
--    conversation within 24 hours, the server adds one 'system' message with the configured text and the
--    active contact channels. No contact details are invented here: production starts with an empty
--    channel list until staff add real ones (Admin → Settings → Support auto-reply).

-- ---------------------------------------------------------------------------
-- Admin inbox flag (separate from read receipts)
-- ---------------------------------------------------------------------------
alter table public.support_conversations add column staff_unread boolean not null default false;
comment on column public.support_conversations.staff_unread is 'Set by staff "Mark unread"; cleared when staff open the conversation. Never changes read receipts.';

create or replace function public.support_mark_unread(p_conversation_id uuid) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  changed integer;
begin
  if not private.can_support() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.support_conversations c set staff_unread = true where c.id = p_conversation_id;
  get diagnostics changed = row_count;
  if changed = 0 then
    raise exception 'conversation_not_found' using errcode = '42501';
  end if;
  return changed;
end;
$$;

-- Marks messages from the *other* side as seen (sets read_at once; never overwritten).
create or replace function public.support_mark_read(p_conversation_id uuid) returns integer
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
    get diagnostics changed = row_count;
  elsif private.can_support() then
    update public.support_messages m set read_at = now()
      where m.conversation_id = p_conversation_id and m.read_at is null and m.sender_type = 'commuter';
    get diagnostics changed = row_count;
    update public.support_conversations c set staff_unread = false where c.id = p_conversation_id and c.staff_unread;
  else
    raise exception 'conversation_not_found' using errcode = '42501';
  end if;
  return changed;
end;
$$;

-- Read receipts may be set but never cleared or moved (protects "Seen" times shown to commuters).
create function private.guard_read_receipt() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.read_at is not null and new.read_at is distinct from old.read_at then
    new.read_at := old.read_at;
  end if;
  return new;
end;
$$;
create trigger support_messages_receipt_guard before update on public.support_messages
  for each row execute function private.guard_read_receipt();

-- ---------------------------------------------------------------------------
-- Auto-reply configuration
-- ---------------------------------------------------------------------------
create table public.support_auto_reply_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  message text not null check (length(btrim(message)) between 1 and 600),
  support_hours text not null default '' check (length(support_hours) <= 200),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
comment on table public.support_auto_reply_settings is 'Single row. Text of the automated support acknowledgement.';
insert into public.support_auto_reply_settings (id, message) values
  (true, 'Thanks for contacting SakayWise Support. We received your message, and a support administrator will reply in this chat as soon as possible.');

create table public.support_contact_channels (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('email', 'phone', 'sms', 'messenger', 'facebook', 'website', 'other')),
  label text not null check (length(btrim(label)) between 1 and 60),
  value text not null check (length(btrim(value)) between 1 and 200),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.support_contact_channels is 'Alternative ways to reach SakayWise, listed in the automated reply and on the guest support screen. Staff-managed; never invented.';

create function private.stamp_auto_reply_editor() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;
create trigger support_auto_reply_settings_stamp before update on public.support_auto_reply_settings
  for each row execute function private.stamp_auto_reply_editor();
create trigger support_contact_channels_touch before update on public.support_contact_channels
  for each row execute function private.touch_updated_at();
create trigger support_auto_reply_settings_audit after update on public.support_auto_reply_settings
  for each row execute function private.audit_row();
create trigger support_contact_channels_audit after insert or update or delete on public.support_contact_channels
  for each row execute function private.audit_row();

alter table public.support_auto_reply_settings enable row level security;
alter table public.support_contact_channels enable row level security;
-- Contact information is public on purpose (guests see it on the support screen).
create policy "public reads auto-reply settings" on public.support_auto_reply_settings for select to anon, authenticated using (true);
create policy "support staff edit auto-reply settings" on public.support_auto_reply_settings for update to authenticated
  using (private.can_support()) with check (private.can_support());
create policy "public reads active contact channels" on public.support_contact_channels for select to anon, authenticated
  using (is_active or private.can_support());
create policy "support staff add contact channels" on public.support_contact_channels for insert to authenticated with check (private.can_support());
create policy "support staff edit contact channels" on public.support_contact_channels for update to authenticated
  using (private.can_support()) with check (private.can_support());
create policy "support staff remove contact channels" on public.support_contact_channels for delete to authenticated using (private.can_support());
revoke all on public.support_auto_reply_settings, public.support_contact_channels from anon, authenticated;
grant select on public.support_auto_reply_settings, public.support_contact_channels to anon, authenticated;
grant update (enabled, message, support_hours) on public.support_auto_reply_settings to authenticated;
grant insert, update, delete on public.support_contact_channels to authenticated;

-- Composes the automated reply text (also used by tests and as the single source of the format).
create function public.support_auto_reply_text() returns text
language sql stable security definer set search_path = '' as $$
  select left(
    s.message
    || coalesce(E'\n\nOther ways to reach us:' || (
         select string_agg(E'\n• ' || ch.label || ': ' || ch.value, '' order by ch.sort_order, ch.label)
         from public.support_contact_channels ch where ch.is_active), '')
    || case when btrim(s.support_hours) <> '' then E'\n\nSupport hours: ' || btrim(s.support_hours) else '' end,
    2000)
  from public.support_auto_reply_settings s where s.id;
$$;
grant execute on function public.support_auto_reply_text() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Automated reply trigger
-- ---------------------------------------------------------------------------
create function private.support_auto_reply() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  settings public.support_auto_reply_settings;
begin
  if new.sender_type <> 'commuter' then
    return null;
  end if;
  select * into settings from public.support_auto_reply_settings s where s.id;
  if not found or not settings.enabled then
    return null;
  end if;
  -- Once per conversation per 24 hours, and never while staff are actively replying.
  if exists (
    select 1 from public.support_messages m
    where m.conversation_id = new.conversation_id and m.id <> new.id
      and m.sender_type in ('admin', 'system') and m.created_at > now() - interval '24 hours'
  ) then
    return null;
  end if;
  insert into public.support_messages (conversation_id, sender_type, sender_id, message, request_id, created_at)
  values (new.conversation_id, 'system', null, public.support_auto_reply_text(), gen_random_uuid(),
          -- strictly after the commuter's message (both are in the same transaction)
          greatest(clock_timestamp(), new.created_at + interval '1 millisecond'));
  return null;
end;
$$;
create trigger support_messages_auto_reply after insert on public.support_messages
  for each row execute function private.support_auto_reply();

-- Settings/channel edits refresh the guest support screen and the admin console.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.support_contact_channels, public.support_auto_reply_settings;
  end if;
end;
$$;
