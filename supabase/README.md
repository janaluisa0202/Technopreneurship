# SakayWise database (Supabase)

| Path | Purpose |
| --- | --- |
| `migrations/` | Version-controlled schema, RLS policies, RPCs. Applied in filename order. |
| `seed.sql` | **Generated** illustrative demo data (`npm run seed:generate`). Never edit by hand. |
| `config.toml` | Supabase CLI settings for local development only. |
| `db-tests/` | Node tests that run every migration + seed on PGlite (real Postgres in WASM) and check constraints, RLS and RPC behaviour. `npm run test:db`. Not pgTAP; the Supabase CLI does not run them. |

## Migrations

| File | Contents |
| --- | --- |
| `20261110120000_foundation_and_admin_roles.sql` | Enums, `private` helper schema, `admin_role_assignments`, `has_admin_role()`, audit log |
| `20261110120100_transport_network.sql` | `transport_places`, `transport_stops`, `transport_services`, `queue_terminals`, `transport_segments`, `popular_journeys` |
| `20261110120200_fareguard.sql` | `fare_matrices`, `fare_rules`, `get_current_fare_rules()` |
| `20261110120300_queuesense.sql` | `queue_reports`, `queue_terminal_signals`, `submit_queue_report()`, `get_queue_estimates()` |
| `20261110120400_roadwatch.sql` | `road_advisories`, `road_advisory_impacts` |
| `20261110120500_support_messaging.sql` | `support_conversations`, `support_messages`, `support_*` RPCs |
| `20261110120600_accounts_retention_realtime.sql` | Optional account tables, `private.purge_expired_data()`, Realtime publication |

All migrations are **additive** (new objects only). They do not alter or drop anything that existed before, because no schema existed before.

## Applying

```sh
# Local (Docker required): starts Postgres/Auth/Realtime, applies migrations + seed.sql
npx supabase start
npx supabase db reset

# Hosted project (after `npx supabase login` and `npx supabase link --project-ref <ref>`)
npx supabase db push            # migrations only; does NOT load seed.sql
```

Load demo data into a hosted **demo/staging** project only, via the SQL editor (paste `seed.sql`) or `psql "$DATABASE_URL" -f supabase/seed.sql`. Re-running it is safe (upserts) and refreshes the simulated advisory times.

## Rollback and recovery

Supabase migrations are forward-only; recovery is done with a new migration, never by editing an applied file.

1. **Before pushing to a shared project:** `npx supabase db diff` / `db push --dry-run`, and take a backup (Dashboard → Database → Backups, or `pg_dump`). Free-tier projects have limited automatic backups — export manually before risky changes.
2. **Undo an applied migration:** write a new migration that reverses it. Reverse order for these files is 0600 → 0000. For example, to remove support messaging:
   ```sql
   alter publication supabase_realtime drop table public.support_messages, public.support_conversations;
   drop function public.support_assign(uuid, uuid), public.support_set_status(uuid, text), public.support_mark_read(uuid),
     public.support_send_message(uuid, text, uuid), public.support_update_conversation(uuid, text, text, text, text),
     public.support_create_conversation(text, uuid, text, text, text);
   drop table public.support_messages, public.support_conversations;
   drop function private.support_subject(text), private.clean_optional(text, integer);
   ```
   Dropping tables destroys their data — export first and get team approval.
3. **Wipe a local database:** `npx supabase db reset` rebuilds from migrations + seed.
4. **Remove demo data from a shared project:** delete rows whose `provenance = 'illustrative-demo'` / `verification_status in ('illustrative-sample','simulated')`, children first (impacts, fare rules, segments, then stops/services/terminals/places). Queue reports reference terminals with `on delete restrict`, so purge or reassign reports first.
5. **Migration history drift** (`supabase migration list` shows mismatches): repair with `npx supabase migration repair --status applied|reverted <version>` after confirming the real schema state.
