# Backend security and privacy

## Authorization model

| Principal | How identified | Can |
| --- | --- | --- |
| Public visitor | publishable key, no session (`anon` role) | Read active network, current fares, published advisories, queue **aggregates**. |
| Guest | Supabase anonymous sign-in JWT (`authenticated`, `is_anonymous = true`) created on first submission | Submit queue reports; create/read/write **own** support conversations; read own raw reports. |
| Commuter account (future) | non-anonymous JWT | As guest + own `commuter_preferences` / `commuter_saved_trips`. |
| Admin roles | non-anonymous JWT + active row in `admin_role_assignments` | Per [ADMIN_DATA_CONTRACTS.md](ADMIN_DATA_CONTRACTS.md). |

- Every table has RLS enabled and explicit grants (least privilege; Supabase's broad default grants are revoked per table).
- Commuter writes go only through `security definer` RPCs with `search_path = ''` that derive identity from `auth.uid()`, set timestamps/expiry/moderation server-side and validate input. Tables have no INSERT grant for commuters.
- Admin checks (`private.has_admin_role`) require a non-anonymous JWT **and** a non-anonymous `auth.users` row **and** an active assignment. A frontend flag, LocalStorage value or forged `is_anonymous` claim grants nothing.
- Unknown and other people's conversation ids return the same `conversation_not_found` error (no probing).
- Browser config accepts only the publishable/anon key; the app refuses to start with an `sb_secret_…` or `service_role` key. `.env*` files are git-ignored.

## Abuse prevention and rate limits

| Action | Limit |
| --- | --- |
| Queue report | 6 per reporter per 10 min; 1 per terminal per reporter per 3 min; idempotent `request_id`; details ≤ 150 chars |
| Queue aggregation | One vote per reporter per terminal (latest); rejected reports excluded; reports expire after 30 min |
| Support conversation | 5 per hour, 20 open per owner; idempotent `request_id` |
| Support message | 10 per minute per sender; identical text within 5 s rejected; 100 commuter messages per conversation; ≤ 2,000 chars |
| Anonymous sign-ins | Supabase Auth rate limit (configure; CAPTCHA recommended for production) |

Rate-limit errors use SQLSTATE `PT429` → HTTP 429. Per-user limits are serialised with advisory locks so they cannot be raced. Because guests can create new anonymous sessions, per-IP limits on anonymous sign-in (and CAPTCHA) are the outer defence.

## Privacy by design (RA 10173 considerations)

This is an engineering summary, **not legal advice or a compliance claim**. Compliance with the Data Privacy Act of 2012 (RA 10173) and NPC issuances requires an organisational process (privacy notice, lawful basis, DPO/point of contact, breach procedure, data subject requests) that the team must own.

- **Minimisation:** no names, phone numbers or locations are required. Support nickname/email/related trip are optional and visible only to the owner and support staff. Queue reports store a terminal id, level, optional short text and a pseudonymous user id — no GPS or location history. Manual addresses, saved trips and settings stay in the browser.
- **Transparency:** commuter screens state what is sent, to whom, and that community reports are unverified. Local demo history is never uploaded.
- **Purpose limitation:** queue reports are used only for aggregated estimates and moderation; raw reports are not public.
- **Logging:** the audit log never copies support message bodies; the frontend does not log message contents.
- **Retention (proposed, to be agreed):** queue reports 30 days; closed support conversations 365 days; audit log 730 days; deleting an auth user cascades to their conversations. Implemented by `private.purge_expired_data()` — schedule it with `pg_cron` once agreed. Clean up stale anonymous users periodically (Supabase docs describe this).
- **Data subject requests:** a user's conversations/messages are found by `owner_id`; deleting the `auth.users` row removes them. Guests who clear browser storage lose access to their guest session — tell users this in the privacy notice.
- **Security of processing:** RLS everywhere, least privilege, server-side validation, TLS (Supabase), secrets outside the repo.

## Admin integration additions (2026-11-12)

- Commuters now sign in with email accounts. `profiles` stores display name, email and last-seen time; only the owner and staff can read a row. Staff need it to answer support requests.
- The admin site decides nothing itself: `my_admin_roles()` is presentation only, and each write is re-checked by RLS/RPCs. A customer JWT was verified to be rejected on `promos` inserts and `admin_list_users()`, and a support_staff JWT on incident updates and the audit log.
- Broadcasts (`admin_messages` with audience `all`/`route`) are readable by every signed-in user, so never put personal data in them. One-to-one messages are visible only to their recipient (in the support thread) and staff.
- Route targeting happens on the device; the server stores no commuter routes or location history.
- Activity entries for support actions record the action and subject, never message bodies.

## Known residual risks

- Anonymous sessions make Sybil attacks cheaper; one-vote-per-reporter and moderation reduce, but do not eliminate, coordinated false queue reports. Confidence labels and the "not verified" wording must stay.
- The Realtime publication includes `support_messages`; Realtime enforces RLS per subscriber, but keep Supabase Realtime up to date and test after upgrades.
- `contact_email` is stored in plaintext in Postgres (encrypted at rest by Supabase). Avoid exporting it; consider dropping it if email follow-up is not used.
