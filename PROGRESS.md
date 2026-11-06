# Progress Log

The agent reads this file at the start of every run and updates it at the end.
Newest entries go at the top of the Log section.

## Current status
Application foundation is in place: Next.js App Router with strict TypeScript, ESLint, Vitest, a responsive dark entry page, and a Postgres schema. Gameplay is not implemented yet.

## Decisions made
- Python only for v1
- Stack: Next.js + TypeScript, Node WebSockets, Postgres, Judge0 or Piston for sandboxing
- Rating: Glicko-2 (Elo as a first pass is fine)
- Winner order: most tests passed, then runtime on largest tests, then earlier submit time
- Node 24 and npm lockfile for reproducible installs; GitHub Actions runs tests, lint, typecheck and production build.
- SQL migrations are transactional and tracked in Postgres. PGlite executes schema tests without an external database.

## Blockers
- Docker daemon is not running in this environment, so Docker Postgres startup and the network migration runner were not exercised. The SQL itself passes embedded Postgres tests.
- npm audit reports 8 moderate development dependency findings through typescript-eslint/minimatch; no production dependency findings. Revisit when upstream tooling updates; no forced major downgrade applied.

## Next up
Design system: reusable colors, buttons, typography and dark theme. The current page only provides starter styles.

## Log
### 2026-11-06 — Project scaffold
- Selected the scaffold as the highest-value dependency for all subsequent work; checked off only that item.
- Added Next.js + TypeScript, ESLint, Vitest/jsdom, a clear under-construction entry page, and CI checks.
- Added users, problems, matches, submissions and rating history tables, constraints and indexes; included a serialized transactional migration runner, Docker Compose, .env.example and local setup documentation.
- Added page availability coverage and database tests for initial ratings, username validation, match creation, self-match rejection, submission counts, completed results and unique rating history.
- Validation: all 4 tests passed across 2 files; lint, typecheck and production build passed. Docker integration remains unverified because its daemon is unavailable.
