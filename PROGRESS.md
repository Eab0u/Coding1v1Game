# Progress Log

The agent reads this file at the start of every run and updates it at the end.
Newest entries go at the top of the Log section.

## Current status
Participant-only post-match results are available at /match/<id>/results, linked from completed arenas. Apply migration 004_match_results.sql. Results use persisted winner, rating history and explicit final-score snapshots; the pending lifecycle service must write these atomically. Rematch invitations remain a separate backlog item.

The participant-only arena is implemented at /match/<id>, linked from matchmaking reservations, with locally bundled Monaco Python editing, server-time countdown, problem/examples panel and polling opponent progress. Pending matches wait for activation; Submit is disabled until the separate lifecycle service exists. Drafts live only in the open tab.

Optional duel sound and animated feedback are implemented as shared components, with match-found feedback connected to matchmaking. Sound defaults off, persists locally and unlocks through user interaction. The future arena/results screens must call the shared test-pass/fail and win/loss cues when their authoritative events exist.

Matchmaking fair-play basics now share command limits across account connections, throttle handshake attempts before authentication and rotate problems using both players' exposure histories. Optional paste blocking remains off until an editor exists. Worker counters reset on restart; reverse proxies need per-client handshake limits.

Friend requests and accepted friendships are available at /friends, with authenticated friends-only global and weekly standings. Apply migration 003_friends.sql before using these flows.

Mobile layout polish is implemented for the existing home, account, profile and leaderboard pages, with Chromium regression coverage for narrow phones through desktop widths. Future arena/results screens will need their own responsive checks when implemented.

The problem pipeline is implemented: deterministic small-input generation, sandbox-only solution validation and immutable publication. The original problem catalog is still pending; no real catalog problems have been published.

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
Configure an isolated Judge0 instance and author/validate problems 1?20 to enable pairing. Implement lifecycle orchestration (activation/expiry, sandbox submissions, completion and atomic ratings), connect it to the arena, then build results. Perform deployment smoke tests before enabling ranked play.

## Log
### 2026-11-06 - Post-match results screen
- Selected and checked off the post-match results screen item. Added participant-only /match/<id>/results with WIN/LOSS/DRAW banners, animated signed rating changes, profile links and side-by-side final test counts, median benchmark CPU and submission elapsed time. Added completed-arena navigation and New match navigation to the existing queue entry point.
- Added migration 004_match_results.sql for explicit final scorer snapshots. The screen never guesses which submission counted from submission history. Missing historical scores and ratings have honest states; no-submission time is distinct from missing score data.
- Authentication uses the server session; unknown, unfinished, future-completed and nonparticipant matches return the same 404. Infrastructure errors show generic feedback. Explicit projection excludes code, hidden tests and secrets.
- Added embedded Postgres access/privacy/outcome/perspective/score tests, route authentication/error tests, all-outcome and missing-data UI tests, arena-link coverage and Chromium viewport/reduced-motion coverage.
- Validation: 207 tests across 31 files passed; lint, typecheck and production build passed. No player code executed.
- Limits: apply the migration before loading results. Lifecycle must atomically persist two participant score snapshots with completion and rating history; orchestration is still pending, so ranked play is not enabled. Rematch is visibly disabled with an explanation; added a separate consent/expiry invitation backlog item. Live database and deployment smoke checks remain pending.
- Next: lifecycle orchestration and isolated sandbox/catalog validation, then consensual rematch invitations.

### 2026-11-06 - Match arena screen
- Selected and checked off the match screen item. Added /match/<id> with locally bundled Monaco Python editing, player scoreboard, server-time countdown, opponent test progress and statement, constraints, signature and examples. Added a responsive stacked layout and matchmaking Open arena link.
- Added a participant-only snapshot query and authenticated, no-store GET endpoint. Explicit projection excludes hidden tests, solutions, opponent code and account secrets. Progress uses the latest judged opponent submission. Unknown/nonparticipant matches return the same 404.
- Sequential polling has a request timeout, aborts on unmount and reports stale updates while retrying. Snapshots preserve drafts; elapsed time uses a monotonic clock anchored to server time. Expired clocks clamp to zero and ended matches lock editing.
- Added embedded Postgres privacy/access/progress tests, API authentication/error/cache tests, countdown, polling/draft/cleanup UI coverage and matchmaking-link coverage. All 198 tests across 28 files passed; lint, typecheck and production build passed. Production dependency audit is clear after overriding Monaco's DOMPurify dependency to patched 3.4.17; existing eight moderate development findings remain.
- Added an explicit lifecycle backlog item. Reservations still need activation; Submit is disabled with an explanation. Drafts are in-memory only. Actual browser Monaco behavior and live database/proxy integration still need smoke testing. No player code executed; existing sandbox/database blockers remain.
- Next: isolated sandbox and validated catalog, lifecycle orchestration, then post-match results.

### 2026-11-06 - Sound effects and animations
- Selected and checked off the shared sound/animation backlog item, which can be implemented without publishing unvalidated problems or running player code. Added five distinct, original synthesized cues: match found, test passed, test failed, win and loss, plus accessible text badges and short arrival/settle animations.
- Added a reusable feedback hook/component and integrated match-found feedback into the existing queue. The existing socket guard prevents duplicate/stale frames replaying the cue. Added a labeled Sound on/off toggle with pressed state; sound defaults off and persists locally. Enabling sound previews the test-pass cue.
- Audio unlocks only from user gestures, stays silent in hidden tabs, has bounded low-volume notes, disconnects finished nodes and closes the context on mute/unmount. Missing audio support, suspended contexts and storage failures preserve visual feedback. All cue animations honor reduced motion.
- Added audio scheduling/lifecycle, all five cue, consent/persistence, unavailable API/storage, hidden-tab and queue duplicate-frame tests. Added Chromium coverage for visible feedback at 320px and reduced-motion suppression.
- Validation: all 191 tests across 25 files passed; lint, production build and typecheck passed. No player code executed.
- Limits: the arena and results screens do not exist yet; their authoritative test/result events must call the shared notify API when implemented. Actual device sound and browser autoplay policy need deployment smoke checks. Existing sandbox/database blockers remain.
- Next: configure the isolated sandbox and validate problems 1-20, then implement arena lifecycle/screens using the shared feedback components.

### 2026-11-06 - Anti-cheat basics
- Selected and checked off only anti-cheat basics: existing queue admission controls had reconnect bypasses and random selection could immediately repeat a challenge.
- Added bounded, expiring worker-level quotas: 20 commands/account/10 seconds across reconnects and tabs, and 30 handshake attempts/peer IP/minute before authentication. Invalid commands count; excess commands close with 1008 and handshakes return 429. Active counters cannot be evicted by filling the key limit.
- Replaced random-only selection with unseen-first, then least recently exposed challenges across either participant. Cancelled reservations count against reroll fishing; published/difficulty filters and random ties remain. Single-problem catalogs still work.
- Added quota boundary/capacity tests, real WebSocket reconnect/account isolation and pre-authentication handshake tests, and embedded Postgres rotation coverage. No player code executed.
- Validation: all 182 tests across 24 files passed; lint, production build and typecheck passed. Fixed the upgrade socket type error found by the build by reading the peer address from the HTTP request socket.
- Limits: counters reset on worker restart and depend on the existing single-worker deployment. Documented proxy address behavior and per-client proxy configuration. Optional paste blocking remains off; editor/submission controls belong to the upcoming arena. Existing sandbox and database deployment blockers remain.
- Next: configure the isolated sandbox and validate problems 1-20, then implement the match screen and lifecycle orchestration.

### 2026-11-06 - Friends and friends-only standings
- Selected the remaining social backlog item as a complete player flow supported by existing accounts and rankings. Checked off only friend relationships and friends-only filtering.
- Added a migration with unique unordered friend pairs, no self-friendship and cascading account deletion. Added case-insensitive invitations, explicit recipient acceptance, decline/cancel and removal by either participant. Reciprocal requests cannot silently accept a friendship.
- Added /friends with labeled invitation controls, incoming/outgoing states, profile links and clear feedback. Linked it from account and leaderboard navigation. Global and weekly friends filters include the signed-in player and accepted friends, computing ranks within that circle before the top-100 limit. Pending requests and unrelated players are excluded.
- Added origin-checked authenticated POST handling with bounded inputs, session-derived actor IDs and generic infrastructure errors. No private account fields are projected.
- Added embedded Postgres tests for consent, duplicate/reciprocal requests, unauthorized mutation, removal, invalid/self/missing targets and both leaderboard periods. Added route and page tests for access controls, actor spoofing, errors and filter preservation.
- Validation: all 177 tests across 23 files passed; lint, production build and typecheck passed. Fixed a PowerShell text-encoding change caught by the build. No player code executed.
- Limits: migration tested in embedded Postgres; live database and browser deployment smoke checks remain pending. Existing infrastructure blockers remain. No notifications or rematch invitations were added.
- Next: configure the isolated sandbox and validate problems 1-20, then implement the match screen and lifecycle orchestration.

### 2026-11-06 - Mobile layout polish
- Selected the most valuable remaining item that can be completed without the unpublished catalog or live sandbox: making existing player flows usable on phones. Checked off only mobile layout polish.
- Prevented long names, signatures and problem text from forcing grid/page overflow. Added compact phone spacing, full-width Play/search controls, wrapping account headers and rating badges, stable record cards and readable recent-duel rows. Header and table links have 44px minimum touch heights.
- Kept wide standings/history tables locally scrollable with named, focusable regions and preserved native table semantics. Keyboard users can focus and scroll to hidden columns.
- Added headless Chromium regression coverage using actual rendered page components and fixture data: signed-in/guest home and account, populated profile and weekly leaderboard, 24-character usernames, long unbroken text and large records at 320/375/768/1280px. Tests check document overflow, keyboard scrolling and action target heights. Added browser installation to CI and documented local setup.
- Validation: all 170 tests across 20 files passed; lint, typecheck and production build passed. Corrected test targeting to select table scroll regions rather than semantic page sections, and used ArrowRight to verify horizontal keyboard scrolling.
- Limits: browser coverage uses server-rendered fixture content, not a running deployment; live database/proxy/WebSocket smoke checks remain pending. Existing Docker, sandbox and development dependency blockers remain. Arena and results responsiveness will be addressed with those future screens.
- Next: configure the isolated sandbox and author/validate problems 1–20, then implement the match screen and lifecycle orchestration.

### 2026-11-06 - Problem generation, validation and publication pipeline
- Selected the problem pipeline as the highest-value dependency for real matchmaking. Checked off only this backlog item.
- Added strict JSON draft parsing and a deterministic seeded integer/integer-array generator producing 2,000 random small inputs. Compared reference and brute-force solutions in separate sandbox namespaces with fresh argument copies, in bounded batches. No Python or author-supplied generator code executes on the host.
- Added authored example/hidden-test checks for the reference, example/edge checks for brute force, and explicit Judge0 final-status diagnostics. Every benchmark must CPU-timeout on all three brute-force runs; crashes, wrong answers and partial timeouts fail validation. Infrastructure failures prevent publication.
- Added validate/publish CLI commands and an authoring guide. Publication revalidates the exact cloned draft and atomically inserts public metadata, private solutions, the suite and generator validation metadata/digest. Duplicate slugs fail instead of replacing suites used by existing matches.
- Added tests covering deterministic generation/bounds, malformed drafts, validation stages, infrastructure errors, timeout versus crash diagnostics, multiple benchmarks, snapshot mutation, embedded Postgres publication and duplicate protection. No player or author Python code executed.
- Validation: all 169 tests across 19 files passed; lint, typecheck and production build passed. Fixed a suite type inference error and an unused test import found by checks.
- Limits: no configured live Judge0 was available, so actual Python execution, isolation and resource enforcement still need deployment smoke tests. The initial declarative generator supports integers and integer arrays; other problem families need additional generator types. No catalog problems were published during mocked/embedded tests; problems 1–20 remain unchecked. Existing infrastructure blockers remain.
- Next: configure the isolated sandbox and author/validate the initial problem catalog, then match screen/lifecycle orchestration.

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




