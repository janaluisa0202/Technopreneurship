# SakayWise conflict-resolution files

This archive contains merged replacements for the five files that were unresolved during the merge of `origin/main` into `feature/backend-integration`.

## Files
- `src/apps/commuter/CommuterApp.tsx`
- `src/apps/commuter/hooks/useSupportCenter.ts`
- `src/apps/commuter/pages/SupportCenter.tsx`
- `src/shared/i18n/en.ts`
- `src/shared/i18n/fil.ts`

## Merge choices
- Preserves backend live catalog loading, Supabase queue reporting, and Supabase RoadWatch adapters from the backend branch.
- Adds authenticated commuter props, sign-out settings props, and the demo-mode support unread badge from the frontend branch.
- Uses the shared account/admin support store in demo mode; uses the configured Supabase support adapter in live mode.
- Adds the frontend read-receipt interaction while keeping backend message state and status labels.
- Unions both translation dictionaries. Filipino uses the incoming wording for `Your conversations`.

## Important live-support limitation
The incoming `accountSupportService.ts` and `supportStore.ts` are local browser-storage demo implementations. The merged hook therefore selects them only when the catalog is in demo mode. In live mode it uses the existing configured Supabase support service. The admin-side Help Center still needs a corresponding Supabase-backed implementation before administrators can manage those live conversations from the new admin interface. The new frontend admin messaging UI is not converted to Supabase by these five-file merges.

## Apply
Extract this archive at the repository root, replacing the five paths above. Then stage those files with `git add`. Do not commit until typecheck, tests, and build pass.

These files were assembled from the branch-side copies supplied for review. They have not been compiled against your full local repository in this environment.
