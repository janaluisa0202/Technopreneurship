-- Minimal emulation of the pieces of a Supabase database that the migrations depend on.
-- TEST-ONLY. Never run against a real Supabase project (which already has all of this).
-- auth.uid()/auth.jwt() mirror Supabase's own definitions (they read request.jwt.claims).
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''), nullif(current_setting('request.jwt.claims', true), ''))::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

create publication supabase_realtime;

-- Supabase grants broad default privileges on public objects; migrations must narrow them.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
