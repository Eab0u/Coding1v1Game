# Progress Log

The agent reads this file at the start of every run and updates it at the end.
Newest entries go at the top of the Log section.

## Current status
Public player profiles now show rating graphs, tier badges, full win/loss/draw records and recent match history at /profile/<username>. Public global and weekly leaderboards are available at /leaderboard, linked from the home page. The home dashboard now connects signed-in players to matchmaking, displays current ratings, win streaks, recent completed duels and a published daily challenge (with honest empty states). Authenticated WebSocket matchmaking now pairs players within widening rating bands and persists recoverable pending match tickets. Username/password authentication, database-backed sessions, application foundation, design system, tested match scoring and Glicko-2 rating calculations are in place: Next.js App Router, Postgres schema, reusable UI primitives, dark theme tokens and a responsive entry page. A tested Judge0 sandbox adapter produces scorer-compatible results. Published problems, match screen/lifecycle, rating persistence orchestration and live sandbox verification remain pending.

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
Problem pipeline and validated published problems to enable pairing, then match screen and lifecycle orchestration (pending activation/expiry, submissions and completion). Configure an isolated Judge0 instance and perform deployment smoke tests before enabling ranked play.

## Log
### 2026-11-06 - Player profiles and rating graph
- Selected the profile page as a complete player-facing use of existing rating/history storage without depending on unfinished match orchestration. Checked off this item only.
- Added public case-insensitive /profile/<username> routes, linked from signed-in home navigation and leaderboard players. Unknown/invalid players return 404; database errors show generic feedback.
- Added current MMR and documented tier thresholds, all-time completed win/loss/draw records, the last 20 matches with opponent profile links and rating deltas, and the last 50 rated duels as a responsive SVG graph with expandable dated text data. Empty profiles and matches without ratings have explicit states. Future and unfinished matches are excluded.
- Added embedded Postgres and page tests covering privacy, parameterized lookup, record aggregation, limits/order, tier boundaries, constant graphs, accessible data, empty states, 404s and infrastructure failures. Fixed parameter inference errors in SQL test fixtures. No player code executed.
- Validation: all 144 tests across 18 files passed; lint, typecheck and production build passed.
- Limits: browser visual inspection and live Postgres smoke testing remain unverified. Profile history will populate once match completion writes results and ratings. Existing infrastructure blockers remain.
- Next: problem pipeline and validated published problems, then match screen/lifecycle orchestration.

### 2026-11-06 - Global and weekly leaderboard
- Selected the leaderboard as a complete player-facing improvement supported by existing ratings and history; checked off this item only. Added a separate future item for friend relationships and filtering, which have no existing data model.
- Added a public, dynamically rendered /leaderboard route and home navigation. Global standings rank current ratings; weekly standings rank net rating gain from completed duels since Monday 00:00 UTC, excluding future and unfinished matches and inactive players.
- Limited standings to 100 players, ranked at full precision with shared ranks and deterministic ordering. Queries project only public names and rating data. Added clear ranking rules, accessible table headings and period navigation, responsive styling, top-three accents, empty states and generic database error feedback.
- Added embedded Postgres tests for ranking, precision, ties, row limits, privacy and weekly time/status boundaries, plus page tests for filters, gains, empty/error states and invalid period fallback. No player code executed.
- Validation: all 138 tests across 16 files passed; lint, typecheck and production build passed after fixes. Corrected a test hook returning a mock, used Next Link for home navigation, and reran typecheck after build refreshed generated route types.
- Limits: browser visual inspection and live Postgres smoke testing remain unverified; existing infrastructure blockers remain. Weekly standings will populate once match completion persists ratings/history. Friends filtering remains on the backlog.
- Next: problem pipeline and validated published problems, then match screen/lifecycle orchestration.

### 2026-11-06 - Home dashboard and Play
- Selected the home page as the highest-value player-facing entry point to the existing queue; checked off only this backlog item.
- Replaced the disabled Play placeholder with a same-origin authenticated WebSocket client. Added server-reported wait/rating bands, cancellation acknowledgement, connection timeout, retry after errors, stale connection protection and cleanup on navigation. Reserved tickets remain visible without implying the unfinished arena is available.
- Added server-rendered current rating, consecutive win streak and five recent completed results. Streak counts the full history rather than the five-row preview; draws break streaks. Guests get a sign-in action and clear empty states.
- Added a deterministic UTC daily selection from published problems, projecting only public fields. Added responsive dashboard cards, a larger primary action and reduced-motion-aware searching animation. Corrected outdated account copy.
- Added dashboard, socket interaction and embedded Postgres tests covering private-field exclusion, draft exclusion, streaks longer than the preview, draws, cancellation, reservations, disconnect/retry, stale events and unmount cleanup.
- Validation: all 134 tests across 14 files passed; lint (after removing an unused test argument warning), typecheck and production build passed. No player code executed.
- Limits: browser/proxy smoke testing remains unverified. Real pairing still requires published problems; activation and the match screen remain upcoming work. Daily card currently presents the challenge statement/signature; practice submission is not implemented. Existing infrastructure blockers remain.
- Next: problem pipeline and validated published problems, then match screen/lifecycle orchestration.

### 2026-11-06 - WebSocket matchmaking
- Selected the matchmaking queue as the highest-value next step after authentication; checked off only that backlog item.
- Added a standalone Node WebSocket worker (`npm run matchmaking`) using database-backed session authentication, strict origin/path checks, refreshed server ratings and a small join/leave protocol. Added environment and reverse-proxy setup documentation.
- Implemented FIFO compatible pairing with mutual rating bands starting at 100, widening by 50 per ten seconds to 800. Added duplicate connection handling, idempotent joins, queue capacity, cancellation, disconnect cleanup and reservation protection during persistence.
- Added transactional pending match creation with stable user-row locking, unfinished-match checks, average-rating difficulty selection and published-only problem selection. Rejoining recovers pending/active tickets without exposing hidden tests or solutions. Catalog/database failures return generic errors and permit explicit retries.
- Enforced a single worker per database through a dedicated advisory lock; added bounded frames, request rates and outgoing buffering, handshake timeout, heartbeat/session revalidation and shutdown handling.
- Added 15 tests covering rating boundaries, FIFO, mutual widening, duplicate tabs, capacity, disconnects, concurrent ticks, reserved cancellation, failure retry, real local WebSocket authentication/protocol/limits, and actual SQL persistence/recovery in embedded Postgres. No player code executed.
- Validation: all 127 tests across 12 files passed; lint, typecheck and production build passed. Fixed Node upgrade socket timeout typing identified by typecheck.
- Limits: the catalog has no published problems yet, so real pairing requires the problem pipeline. Tickets remain pending until the upcoming lifecycle service activates/cancels them. Waiting entries are in memory and must rejoin after restart. Live Postgres advisory-lock, HTTPS proxy and browser smoke checks remain unverified; existing Docker/Judge0/development audit blockers remain.
- Next: problem pipeline and validated published problems, then match screen/lifecycle orchestration.

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




