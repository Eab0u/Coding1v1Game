# Progress Log

The agent reads this file at the start of every run and updates it at the end.
Newest entries go at the top of the Log section.

## Current status
Username/password authentication, database-backed sessions, application foundation, design system, tested match scoring and Glicko-2 rating calculations are in place: Next.js App Router, Postgres schema, reusable UI primitives, dark theme tokens and a responsive entry page. A tested Judge0 sandbox adapter now produces scorer-compatible results. Live gameplay, rating persistence orchestration and live sandbox verification remain pending.

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
WebSocket matchmaking queue and match orchestration. Configure an isolated Judge0 instance and perform deployment smoke tests before enabling ranked play.

## Log
### 2026-11-06 - Player authentication
- Selected authentication as the highest-value remaining prerequisite for identifying ranked players; checked off only this backlog item.
- Added responsive sign-up/sign-in and authenticated account views, linked from the entry page, with labeled fields, password autocomplete, feedback and sign-out.
- Added asynchronous salted scrypt passwords, case-insensitive unique usernames, seven-day opaque sessions stored only as SHA-256 digests, database expiry checks, session rotation and revocation. Public account results never contain password hashes.
- Added origin-checked POST routes, HttpOnly/SameSite cookies (Secure in production), bounded credential/body validation, generic infrastructure errors and atomic per-username throttling shared across instances.
- Added migration and deployment documentation, including APP_ORIGIN, HTTPS, cleanup, case-only duplicate migration handling and the session contract for future match services.
- Added 19 tests covering crypto, validation, embedded Postgres persistence, duplicate names, wrong credentials, expiry, forged tokens, rotation/revocation, throttling, route protections, cookies and account UI. Fixed a test hook that accidentally returned a mock as a cleanup callback.
- Validation: all 112 tests across 9 files passed; lint, typecheck and production build passed. No player code executed.
- Limits: live Postgres/browser smoke checks remain unverified. Public rollout needs deployment proxy IP/global limits; password recovery is not implemented. Existing Docker, Judge0 and development dependency blockers remain.
- Next: WebSocket matchmaking and match orchestration.
### 2026-11-06 - Sandbox judge service
- Selected the judge as the core remaining dependency for live matches; checked off only this backlog item.
- Added a server-only Judge0 adapter for Python functions and JSON hidden tests. Expected answers stay on the Node server. Every execution explicitly disables network and sets CPU, wall, memory, process and file limits; no local execution fallback exists.
- Runs largest-test benchmarks three independent times, sums CPU milliseconds per run and returns scorer-compatible counts and samples. Benchmark tests must pass all three runs; failed runs receive the full CPU limit.
- Added bounded polling, request abort timeouts, input/config validation and fail-closed infrastructure errors. Service failures cannot become scored losses. Documented deployment settings, exact JSON comparison, benchmark measurement and caller responsibilities.
- Added 37 mocked API tests for limits, polling, correctness, CPU units, multiple benchmarks, all program failure statuses, invalid inputs and infrastructure failures. No player code was executed.
- Validation: all 93 tests across 6 files passed; lint, typecheck and production build passed.
- Blocker/limit: no configured live Judge0 deployment was available. Real sandbox smoke tests, including isolation/resource enforcement, remain required before ranked rollout. Existing Docker and dependency-audit blockers remain.
- Next: authentication, then matchmaking and orchestration. The problem pipeline must supply shared JSON suites and largest-input benchmark flags.

### 2026-11-06 - Glicko-2 ratings
- Selected ratings as a core match dependency that can be completed without sandbox infrastructure; checked off only the rating backlog item.
- Implemented Glickman's revised Glicko-2 volatility solver, rating-period updates, inactive-period uncertainty growth and simultaneous duel updates from pre-match snapshots. New players start at 800 with deviation 350 and volatility 0.06.
- Fixed tau at 0.5; use one completed duel per rating period and a zero rating floor to match database constraints. Preserve full precision and return both rating deltas. Documented these policies and the published algorithm source in README.md.
- Added 20 tests covering the published reference example (with tolerance for the paper's rounded intermediates), wins for both positions, draws, inactivity, upsets, the zero floor, placement uncertainty, invalid inputs and 300 consecutive updates. Tests never execute player code.
- Validation: all 56 tests across 5 files passed; lint, typecheck and production build passed. Corrected a type assertion in the deliberately invalid-score test after typecheck caught it.
- Future match service must atomically persist both rating states and history exactly once per completed match; inactivity scheduling and placement badges remain caller responsibilities. No new infrastructure blockers.
- Next: sandbox judge service; existing infrastructure blockers remain unchanged.

### 2026-11-06 - Match scoring
- Selected scoring as the independently testable rule that defines match outcomes before judge integration; checked off only this backlog item.
- Added a pure scorer that ranks correctness, then numeric median CPU time across three largest-test suite runs, then server-recorded submission time; exact ties draw.
- Rejects invalid counts, mismatched test totals, invalid submission times and missing, negative or non-finite CPU samples. Input samples are never mutated.
- Documented the trusted server/judge contract: same test suite and benchmark, CPU rather than wall time, and CPU-limit accounting for timeouts. Match lifecycle, no-shows and submission selection remain caller responsibilities.
- Added 26 test cases covering both player positions for every tiebreak, outliers, numeric sorting, immutability, zero and fractional timing, complete/partial/zero-pass draws and invalid inputs.
- Validation: all 36 tests across 4 files passed; lint, typecheck and production build passed.
- Next: implement the sandbox judge service. Existing infrastructure blockers remain unchanged.

### 2026-11-06 - Design system
- Selected the design system as the next shared foundation; checked off only this backlog item.
- Added dark palette, spacing, radius and typography tokens; reusable native Button, Card and Badge components with primary/secondary/ghost button variants.
- Applied the system to the entry page with an arena illustration, scoring cards and responsive grids. Play remains disabled with an accessible availability explanation until matchmaking exists.
- Added visible keyboard focus, skip navigation, native disabled states and reduced-motion support; documented component usage in README.md.
- Added component interaction, disabled behavior, variant, attribute forwarding and page accessibility tests.
- Validation: all 10 tests across 3 files passed; lint, typecheck and production build passed. Browser visual inspection was not performed.
- Next: implement the sandbox judge service. Existing infrastructure blockers remain unchanged.

### 2026-11-06 — Project scaffold
- Selected the scaffold as the highest-value dependency for all subsequent work; checked off only that item.
- Added Next.js + TypeScript, ESLint, Vitest/jsdom, a clear under-construction entry page, and CI checks.
- Added users, problems, matches, submissions and rating history tables, constraints and indexes; included a serialized transactional migration runner, Docker Compose, .env.example and local setup documentation.
- Added page availability coverage and database tests for initial ratings, username validation, match creation, self-match rejection, submission counts, completed results and unique rating history.
- Validation: all 4 tests passed across 2 files; lint, typecheck and production build passed. Docker integration remains unverified because its daemon is unavailable.


