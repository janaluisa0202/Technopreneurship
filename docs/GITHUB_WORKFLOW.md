# GitHub collaboration workflow

The supplied folder currently has no `.git` directory or configured remote. The frontend audit did not initialize Git, commit, push, publish or invite anyone. The following are **manual steps for the team after reviewing the handoff**.

## Initial repository setup

Create the team's GitHub repository using your own account/organization. Do not add a second generated README or .gitignore. Review local files first:

```sh
npm ci
npm run typecheck
npm test
npm run build
# Only when the team is ready to create version history:
git init
git branch -M main
git status --short --ignored
```

Stage reviewed source/configuration explicitly. Example:

```sh
git add src tests scripts docs .github index.html package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts .gitignore .env.example README.md
git diff --cached --stat
git diff --cached
```

Confirm no real environment files, keys, private data, `node_modules` or build output were staged. `.env.example` must contain only safe placeholders. The historical `preview/` file is optional reference material; inspect it separately if you choose to include it. Do not replace the React app with it.

Only the repository owner should then make the initial commit, add the verified remote and push. Never paste credentials into source, chat prompts or Git remote URLs. No commit/push is performed by these instructions automatically.

## Working after cloning

```sh
git clone <TEAM_REPOSITORY_URL>
cd sakaywise
npm ci
git switch -c feature/your-module
```

Agree whether PRs target `main` or a shared `develop` branch. Work on focused branches and avoid simultaneous edits to shared state/contracts without coordination. Before submitting a PR:

```sh
npm run typecheck
npm test
npm run build
git status --short
git diff
# Stage reviewed files explicitly, then inspect:
git diff --cached
```

Create your own commit and PR after review. The existing GitHub Actions workflow runs typecheck, tests and build on PRs/pushes targeting main/develop. It performs no deployment. CI has not run on GitHub while the folder has no repository/remote.

## Ownership and integration

| Area | Starting point |
| --- | --- |
| Backend service contracts | `docs/BACKEND_HANDOFF.md`, `services/contracts.ts` |
| Demo adapters and fixture boundary | `services/demoServices.ts`, `services/demoCatalog.ts` |
| Routes | `lib/routeEngine.ts`, `hooks/useRouteRecommendations.ts`, `pages/RoutesPage.tsx` |
| Fares | `lib/fares.ts`, `data/fares.ts`, `pages/FareMatrixPage.tsx` |
| Queues | `services/demoServices.ts`, `lib/queues.ts`, `components/Sheets.tsx` |
| RoadWatch | `types/roadwatch.ts`, `hooks/useRoadWatch.ts`, `lib/advisoryImpact.ts` |
| Support | `types/support.ts`, `lib/supportService.ts`, `hooks/useSupportCenter.ts` |
| Shared UI/settings | `src/shared/`, `components/MobileShell.tsx`, `src/styles.css` |
| Future dashboard | `src/apps/admin/` — reserved, no authentication/dashboard yet |

Preserve the one route engine and demo mode. Remote adapters require deliberate provenance, validation, auth/RLS and coordinated integration; entering Supabase env variables does not enable them.

## Merge conflicts

Fetch the team's latest branch and merge it into your feature branch. Resolve conflicts in VS Code by examining both sides. Run all checks again before the PR. Do not force-push shared branches or discard another teammate's work as a shortcut. Repository protection and collaborator permissions should be set deliberately by the owner.
