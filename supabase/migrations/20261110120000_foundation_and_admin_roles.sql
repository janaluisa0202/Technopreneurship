-- SakayWise foundation: shared types, private helper schema, admin roles, audit log.
-- Supabase specifics used: auth.users, auth.uid(), auth.jwt(), roles anon/authenticated/service_role.
-- Commuter writes never rely on a client-supplied identifier: ownership is auth.uid()
-- from a Supabase JWT (anonymous sign-in for guests, password/OAuth for admins).

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;
comment on schema private is 'Helper functions used by RLS policies and RPCs. Not exposed through the Data API.';

create type public.admin_role as enum ('super_admin', 'admin', 'support_staff', 'transport_data_manager');
create type public.data_provenance as enum ('illustrative-demo', 'verified-source');
create type public.transport_mode as enum ('walk', 'jeepney', 'modern-jeepney', 'uv', 'bus', 'mrt', 'lrt', 'tricycle');
create type public.passenger_category as enum ('regular', 'student', 'senior', 'pwd');
create type public.queue_level as enum ('low', 'mid', 'high');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.jwt_is_anonymous() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

-- ---------------------------------------------------------------------------
-- Administrator role assignments (trusted, server-side)
-- ---------------------------------------------------------------------------
create table public.admin_role_assignments (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.admin_role not null,
  is_active boolean not null default true,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, role)
);
comment on table public.admin_role_assignments is 'Trusted admin roles. A frontend flag is never authorization; policies call private.has_admin_role().';

create trigger admin_role_assignments_touch before update on public.admin_role_assignments
  for each row execute function private.touch_updated_at();

-- super_admin implicitly holds every role. Anonymous (guest) sessions can never be admins.
create function private.has_admin_role(allowed public.admin_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and not private.jwt_is_anonymous()
    and exists (
      select 1
      from public.admin_role_assignments a
      join auth.users u on u.id = a.user_id
      where a.user_id = auth.uid()
        and a.is_active
        and not coalesce(u.is_anonymous, false)
        and (a.role = 'super_admin' or a.role = any (allowed))
    );
$$;

create function private.can_manage_transport() returns boolean
language sql stable set search_path = '' as $$
  select private.has_admin_role(array['admin', 'transport_data_manager']::public.admin_role[]);
$$;
create function private.can_support() returns boolean
language sql stable set search_path = '' as $$
  select private.has_admin_role(array['admin', 'support_staff']::public.admin_role[]);
$$;
create function private.is_super_admin() returns boolean
language sql stable set search_path = '' as $$
  select private.has_admin_role(array['super_admin']::public.admin_role[]);
$$;

-- Guards: no roles for anonymous users; never remove the last active super admin.
create function private.guard_admin_role_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  remaining integer;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    if exists (select 1 from auth.users u where u.id = new.user_id and coalesce(u.is_anonymous, false)) then
      raise exception 'anonymous_user_cannot_be_admin' using errcode = '42501';
    end if;
    if tg_op = 'INSERT' and new.granted_by is null then
      new.granted_by := auth.uid();
    end if;
  end if;
  if (tg_op = 'DELETE' and old.role = 'super_admin' and old.is_active)
     or (tg_op = 'UPDATE' and old.role = 'super_admin' and old.is_active and not new.is_active) then
    select count(*) into remaining from public.admin_role_assignments
      where role = 'super_admin' and is_active and user_id <> old.user_id;
    if remaining = 0 then
      raise exception 'last_super_admin' using errcode = '42501';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger admin_role_assignments_guard before insert or update or delete on public.admin_role_assignments
  for each row execute function private.guard_admin_role_assignment();

alter table public.admin_role_assignments enable row level security;
create policy "admins read own roles; super admins read all" on public.admin_role_assignments
  for select to authenticated using (user_id = auth.uid() or private.is_super_admin());
create policy "super admins grant roles" on public.admin_role_assignments
  for insert to authenticated with check (private.is_super_admin());
create policy "super admins change roles" on public.admin_role_assignments
  for update to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
create policy "super admins revoke roles" on public.admin_role_assignments
  for delete to authenticated using (private.is_super_admin());

revoke all on public.admin_role_assignments from anon, authenticated;
grant select, insert, update, delete on public.admin_role_assignments to authenticated;

-- Convenience for the future dashboard (presentation only; never authorization).
create function public.my_admin_roles() returns setof public.admin_role
language sql stable security definer set search_path = '' as $$
  select a.role from public.admin_role_assignments a
  where a.user_id = auth.uid() and a.is_active and not private.jwt_is_anonymous();
$$;
revoke execute on function public.my_admin_roles() from public, anon;
grant execute on function public.my_admin_roles() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin audit log (who changed managed data, when). Support message bodies are never logged.
-- ---------------------------------------------------------------------------
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  table_name text not null,
  record_id text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_at timestamptz not null default now()
);
create index admin_audit_log_table_time_idx on public.admin_audit_log (table_name, changed_at desc);

create function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_json jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_json jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  rec jsonb := coalesce(new_json, old_json);
begin
  insert into public.admin_audit_log (actor_id, table_name, record_id, action, old_data, new_data)
  values (auth.uid(), tg_table_name, coalesce(rec ->> 'id', rec ->> 'user_id'), tg_op, old_json, new_json);
  return null;
end;
$$;

create trigger admin_role_assignments_audit after insert or update or delete on public.admin_role_assignments
  for each row execute function private.audit_row();

alter table public.admin_audit_log enable row level security;
create policy "admins read the audit log" on public.admin_audit_log
  for select to authenticated using (private.has_admin_role(array['admin']::public.admin_role[]));
revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;
