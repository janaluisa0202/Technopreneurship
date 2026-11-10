# Admin dashboard data contracts

For the future dashboard in `src/apps/admin/`. Every privileged operation is enforced in Postgres (RLS + `security definer` RPCs). The dashboard signs in with Supabase Auth (email/password or OAuth — **not** anonymous) using the same publishable key; it never needs a service-role key.

## Roles

| Role | Can |
| --- | --- |
| `super_admin` | Everything, including granting/revoking roles. Cannot remove the last active super admin. |
| `admin` | Transport data, fares, advisories, queue moderation, support inbox, audit log. |
| `transport_data_manager` | Transport network, fares, advisories, queue moderation. |
| `support_staff` | Support inbox and replies. |

`select * from my_admin_roles()` (RPC `my_admin_roles`) tells the UI which modules to show. It is a convenience only — the database re-checks every request.

## 1. Dashboard overview

Read-only queries an admin can run (all RLS-scoped):

```ts
supabase.from('support_conversations').select('status', { count: 'exact', head: true }).eq('status', 'open');
supabase.from('queue_reports').select('id', { count: 'exact', head: true }).eq('moderation_status', 'unreviewed').gt('expires_at', new Date().toISOString());
supabase.from('road_advisories').select('id', { count: 'exact', head: true }).eq('is_published', true).eq('status', 'active');
supabase.rpc('get_queue_estimates');
```

## 2. Transport route management

Tables: `transport_places`, `transport_stops`, `transport_services`, `transport_segments`, `queue_terminals`, `popular_journeys`. Full CRUD for `admin`/`transport_data_manager`; inactive rows (`is_active = false`) are visible to them and hidden from commuters. Prefer deactivating over deleting (deletes are `restrict`ed where data depends on a row).

Rules enforced by the schema: text IDs (`^[a-z0-9][a-z0-9-]+$`, services may contain `:`); place-endpoint stops must use the place id as their id; segments are directed; walking segments have no service/queue; a ride's service must have the same mode; queue minutes need all of terminal/default level/low/mid/high and must be non-decreasing. Set `provenance = 'verified-source'` only for verified data. Commuter apps load the network on page load.

## 3. Fare matrix management

`fare_matrices` (`matrix_type` `segment|distance`, `mode`, optional `service_id`, `calculator_mode` for distance, `effective_from/to`, `source_name`, `source_url`, `verification_status`) and `fare_rules` (`passenger_category`, `segment_id` or `included_km` + `per_km_amount`, `fare_amount`).

Workflow: create matrix as `pending-review` (hidden from commuters) → add rules → set `verification_status = 'verified'` (requires an `https://` `source_url`; the database stamps `verified_by`/`verified_at`) → set `effective_from`. Retire with `superseded` or `effective_to`. `get_current_fare_rules(p_at)` picks one matrix per segment (verified first, then newest), so verified and sample categories are never mixed; a category without a rule stays missing.

## 4. QueueSense moderation

```ts
supabase.from('queue_reports').select('id,terminal_id,segment_id,queue_level,details,report_source,moderation_status,created_at,expires_at')
  .order('created_at', { ascending: false }).range(0, 49);
supabase.from('queue_reports').update({ moderation_status: 'rejected', moderation_note: 'spam' }).eq('id', id);
supabase.rpc('submit_queue_report', { p_terminal_id, p_queue_level, p_request_id: crypto.randomUUID(), p_report_source: 'terminal-staff' });
```

Only `moderation_status` and `moderation_note` are updatable (column grants); `moderated_by/at` are stamped by the database. Rejected reports are excluded from estimates immediately. Staff reports are the only source treated as verified terminal data. `reporter_id` is a pseudonymous auth id — do not try to identify reporters.

## 5. RoadWatch advisory management

`road_advisories` (mirrors the frontend `RoadAdvisory`) + `road_advisory_impacts` (`target_type` `segment|stop|service|itinerary` with exactly one matching id). Draft with `is_published = false`, add impacts, then publish. Constraints: demo ⇔ simulated; `verified` requires `source_type = 'official'` and an `https://` URL; `scheduled` needs `starts_at`; `ends_at > starts_at`. Editing content bumps `updated_at` (commuter freshness window is 24 h). Commuters receive changes via Realtime.

**Future feeds (provider adapters):** an authorised feed adapter (e.g. a scheduled Edge Function, added later with team approval) maps upstream items to these columns and upserts on `(source_name, external_ref)`, keeping the original `source_url`. No agency API is assumed to exist or be free; none is implemented. Impacts must come from explicit mappings or validated geometry, never text similarity.

## 6. Support inbox

```ts
// Inbox (RLS: support roles see all conversations)
supabase.from('support_conversations').select('id,category,subject,status,nickname,contact_email,related_trip,assigned_admin_id,created_at,last_message_at')
  .in('status', ['open', 'pending']).order('last_message_at', { ascending: false, nullsFirst: false }).range(0, 49);
// Thread, newest page first
supabase.from('support_messages').select('*').eq('conversation_id', id).order('created_at', { ascending: false }).range(0, 49);
// Reply (sender_type 'admin' is derived by the server from the caller's role)
supabase.rpc('support_send_message', { p_conversation_id: id, p_message: text, p_request_id: crypto.randomUUID() });
supabase.rpc('support_mark_read', { p_conversation_id: id });          // marks commuter messages read
supabase.rpc('support_set_status', { p_conversation_id: id, p_status: 'resolved' }); // open|pending|resolved|closed
supabase.rpc('support_assign', { p_conversation_id: id, p_admin_id: userId });
// Live updates
supabase.channel('inbox').on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, refresh).subscribe();
```

Status flow: commuter message → `open`; admin reply → `pending`; admin sets `resolved` (a commuter reply reopens it) or `closed` (final; the commuter's next message starts a new conversation). Never insert messages directly — there is no insert grant, and the RPC is what enforces sender identity. No "online" presence exists; do not display one.

## 7. User / role management (super_admin)

```ts
supabase.from('admin_role_assignments').select('*');
supabase.from('admin_role_assignments').insert({ user_id, role: 'support_staff' });
supabase.from('admin_role_assignments').update({ is_active: false }).match({ user_id, role });
```

Creating auth users (invites) needs the Auth admin API, which requires a secret key — do that from the Supabase dashboard or a future server-side function, never from the browser.

## 8. Basic analytics and audit

`admin_audit_log` (readable by `admin`/`super_admin`) records actor, table, record id, action and before/after JSON for network, fares, advisories, role changes and queue moderation. Support message bodies are never copied into it. Aggregate counts above cover basic analytics; avoid building per-commuter tracking.
