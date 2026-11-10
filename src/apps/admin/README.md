# Admin Dashboard (future phase)

This folder is intentionally reserved for a later sprint. There is no admin dashboard or admin authentication in the commuter prototype.

Planned modules:
- Overview and KPIs (verified data only)
- Route and fare matrix management
- Queue report moderation and trust/reliability
- Para Alerts publishing and verification
- Partner/terminal operations
- User and role management (protected by database RLS and server-side authorization)

Do not expose admin tools with a frontend-only `isAdmin` flag; enforce permissions on the backend.
