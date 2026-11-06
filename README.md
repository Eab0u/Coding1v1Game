# CodeDuel

Ranked one-on-one Python coding duels. This repository currently contains the application and database foundation. Gameplay is tracked in [GOAL.md](GOAL.md).

## Local development

Requires Node.js 22.13+ (Node 24 recommended), npm, and Docker Compose for Postgres.

```powershell
npm ci
Copy-Item .env.example .env
docker compose up -d --wait
npm run db:migrate
npm run dev
```

Open http://localhost:3000. The supplied database credentials are for local development only. Alternatively, set `DATABASE_URL` in `.env` to your own Postgres instance. Never commit real credentials.

## Checks

Install the Chromium test browser once after `npm ci` (Linux: use `--with-deps`):

```powershell
npx playwright install chromium
```

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Vitest tests the entry page in jsdom and executes the actual SQL migration in PGlite (embedded Postgres). Tests need neither Docker nor an external database and never execute player code. Judge service tests mock the Judge0 HTTP boundary; live sandbox verification remains pending.

The mobile regression test also renders the real page components with fixture data in headless Chromium at 320, 375, 768 and 1280 pixels. It checks page overflow, touch target heights and keyboard scrolling of wide tables, including long usernames and problem text. It does not exercise live database, proxy or WebSocket integration.

## Database

`db/migrations` contains ordered SQL migrations for users, problems, matches, submissions and rating history. `npm run db:migrate` applies pending migrations in one transaction, records them in `schema_migrations`, and uses a transaction advisory lock to serialize concurrent runs. Run it again safely after adding migrations; do not edit migrations already applied to a shared database.

Hidden tests, solutions, and submitted source are server-only data. No public database API is exposed. The schema records the median CPU time on large tests; the judge adapter supplies three independent benchmark CPU samples for scoring. Authentication and matchmaking are implemented; gameplay participant authorization and match lifecycle enforcement remain pending.

`docker compose down` stops the local database while preserving its volume.

## Match scoring

`src/lib/scoring.ts` exports `scoreMatch(one, two)` for finalized, trusted judge
results. It returns the winning player (or `null` for a draw), the deciding
criterion and each player's median CPU time. Correctness takes priority over
CPU time; submission time breaks equal CPU medians. Comparisons use exact values
without rounding.

Each result supplies counts for the same hidden test suite, exactly three CPU
millisecond samples for the same largest-test benchmark and a server-recorded
submission time in milliseconds since match start. The judge must account for
timed-out tests using their CPU limit and must never supply wall-clock durations.
Invalid inputs throw `RangeError`. The scorer does not execute code or handle
no-shows, match deadlines or selection among multiple submissions; those belong
to the future match service. Unit tests cover every deciding criterion.

## Ratings

`src/lib/rating.ts` implements [Glickman's revised Glicko-2 algorithm](https://www.glicko.net/glicko/glicko2.pdf)
with tau 0.5 and convergence tolerance 0.000001. `initialRating()` returns
800 rating, 350 deviation and 0.06 volatility, matching database defaults.
`updateRating(player, games)` accepts pre-period opponent snapshots and scores
(win 1, draw 0.5, loss 0); an empty period grows uncertainty only.
`rateMatch(one, two, winner)` treats each completed duel as one period and returns
both updated states and full-precision rating deltas, using both pre-match states.
The match scorer's winner can be passed directly to it.

Ratings have a zero floor to match database constraints; deviation has no artificial
cap. Calculations retain full precision: round only for display. Invalid states,
outcomes and numerically unrepresentable calculations throw `RangeError`.
The future match service must persist both players' rating, deviation, volatility
and rating history atomically and ensure a match is applied once. These pure
functions do not write to the database. Placement uncertainty is represented by
the initial deviation; placement badges and inactivity scheduling belong to that
service. No automatic elapsed-time decay is applied: callers explicitly supply
empty periods if needed. Per-duel updates are a product choice; Glickman recommends
larger batches for the best predictive performance.

## Design system

Shared primitives live in `src/components/ui/index.tsx`: `Button` (primary,
secondary, ghost), `Card`, and `Badge` (neutral, accent). They forward native
HTML attributes and accept additional classes. Buttons default to `type="button"`;
set `type="submit"` explicitly in forms. Use native `disabled` for unavailable actions
and `aria-describedby` to connect an explanation.

`src/app/globals.css` defines the dark palette, spacing, radii, and sans/monospace
font tokens. Green buttons use dark text for contrast. Shared controls include
visible keyboard focus, hover, active and disabled states; motion respects the
reduced-motion preference. The entry page demonstrates these primitives and
collapses its grids to one column below 760px. Reuse these tokens and components
for subsequent gameplay screens.

## Sandbox judge

`src/lib/judge.ts` exports the server-only `createJudge(config)` adapter for the
[Judge0 CE API](https://ce.judge0.com/). Use a maintained, isolated Judge0 deployment
with network disabled at the infrastructure level as well as in submission requests.
Never expose this adapter or hidden tests through a public unauthenticated endpoint.
There is no local execution fallback and no public judge endpoint in this application.

Configure a trusted server URL, Python language ID from that deployment's `/languages`,
CPU seconds and memory kilobytes, plus an optional auth token. Pass these explicitly
as `JudgeConfig`; the adapter does not automatically read environment variables.
The environment example includes names for the future match server to map into config.
Do not use player-supplied URLs, language IDs, limits or test suites.

Call the returned function with Python source, a function name, server-recorded
submission time and JSON tests `{ args: [...], expected: ..., benchmark: true }`.
At least one test must mark the largest-input benchmark. The Python function receives
positional JSON arguments and must return a JSON value; output must contain only that
value. Comparisons are exact, including array order, with object key order ignored.
Tree/linked-list problems will need JSON adapters in the future problem pipeline.
Expected answers remain on the Node server; only source and arguments go to Judge0.

Every test runs in a separate sandbox. Benchmark tests run three independent times;
all three must pass to count that test. CPU seconds are converted to milliseconds
and summed per benchmark run, producing the three samples expected by `scoreMatch`.
The scorer takes their median. Python startup and serialization are included in CPU
measurements, so both players must use identical suites and limits. Wrong answers,
invalid output, compile/runtime errors and timeouts fail the test and receive the
full CPU limit for that run. Judge0 averaging and wall-clock measurements are not used.
Network is disabled, processes and files are limited, and CPU, wall and memory limits
are set on every submission.

HTTP failures, exhausted polling, missing CPU timing and Judge0 internal errors throw
`JudgeUnavailableError`; callers must retry or report unavailability without recording
a loss or rating update. Requests have an abort timeout and polling is bounded; there
are no automatic POST retries that might duplicate jobs. Hidden output and service
error details are not returned. Match orchestration, cancellation and overall queue
admission/rate limits remain future server responsibilities.

All judge tests mock HTTP and never run submitted Python. A configured live sandbox
was unavailable during implementation, so deployment smoke testing (valid function,
wrong answer, infinite loop, memory exhaustion and blocked network) is still required
before enabling ranked matches.


### Player authentication
Run `npm run db:migrate` before using `/account`. Registration and login use case-insensitive usernames, 12-character minimum passwords (256-byte maximum), salted asynchronous scrypt hashes (N=32768, r=8, p=1), and opaque seven-day sessions. Only SHA-256 token digests are stored. Sign-in rotates the browser's previous session; sign-out revokes it in Postgres. Other devices remain signed in.

Set `APP_ORIGIN` to the exact public origin (for example `https://duel.example`) in production, and serve over HTTPS. Auth POSTs require that Origin; cookies are HttpOnly, SameSite=Lax and Secure in production. Future authenticated API/WebSocket handlers must resolve the session through `auth.current` and authorize the requested resource; never trust a client user ID. Cookie behavior follows the [Next.js cookie API](https://nextjs.org/docs/app/api-reference/functions/cookies).

Auth attempts are atomically limited to ten per case-insensitive username per 15-minute window across app instances. Configure additional IP/global request limits at the deployment proxy before public rollout. There is no password recovery flow yet. Periodically delete expired `auth_sessions` and old `auth_attempts` rows (older than 15 minutes); they never authenticate users after expiry. The case-insensitive username migration intentionally fails on existing case-only duplicates; resolve those before migrating an existing deployment. Embedded Postgres tests cover persistence; live database/browser smoke tests remain a deployment check.

## WebSocket matchmaking

After migrating the database, run `npm run matchmaking` alongside Next.js. The worker
reads `.env` and binds to `MATCHMAKING_HOST: MATCHMAKING_PORT` (default loopback,
port 3001). Configure your HTTPS reverse proxy to forward WebSocket upgrades for
`/matchmaking` to that listener, retaining the Cookie and Origin headers. Browsers
connect to `wss://<your-site>/matchmaking` with their existing session cookie.
`APP_ORIGIN` is required and must exactly match the browser origin. Use `ws://`
for local development. Proxy connection/IP limits are required for public rollout.

The protocol accepts only `{"type":"join"}` and `{"type":"leave"}`. Identity and
current rating are resolved from Postgres. Joining returns `queued` with
`waitedSeconds` and `ratingBand`; updates arrive every second. Bands start at 100
rating points, grow by 50 every ten seconds and cap at 800. Both players' bands
must allow the distance. Oldest compatible players get priority. Duplicate joins
preserve queue age; a second connection for the same player is rejected.

Pairing sends `matching`, reserves both entries, then creates one pending match
in a database transaction. The average rating determines easy (<1200), medium
(1200–1599), or hard (1600+) difficulty. A random problem of that difficulty must
have a publication date at or before now. Success sends each player
`{"type":"matched","match":{"id":"…","difficulty":"easy"},"opponent":{"id":"…","username":"…","rating":800}}`.
Hidden tests and solutions never enter the protocol. The match screen will consume
this ticket in a later backlog item; this service does not start a timer or execute code.

Leaving or disconnecting removes an unreserved entry. Once `matching` is sent,
the reservation completes even if a player leaves. Joining again recovers an
existing pending/active match, including after worker restart. Transactions lock
both user rows in stable order and reject unfinished matches. Database/catalog
failures emit a generic `error`, remove the paired entries and allow an explicit
retry; they never create scored losses or rating changes. An empty published
catalog currently prevents pairing. Pending match activation, expiry and cancellation
belong to the upcoming match lifecycle; pending tickets remain recoverable until
that service transitions them.

Run one worker per database: a dedicated Postgres advisory lock rejects additional
workers and loss of that connection terminates the process. Waiting entries are
in memory and clients must rejoin after a restart; persisted tickets survive.
The worker caps connections/queue entries at 1000, messages at 1 KiB and 20 per
ten seconds per connection, bounds outgoing buffering, and uses ping/pong and
session revalidation every 30 seconds. Join also revalidates the session. Deploy
with a process supervisor and route all queue traffic to this single worker.
SIGINT/SIGTERM close connections and release the database lock.

Tests cover the queue policy, cancellation/reservations, failure recovery, real
local WebSocket handshakes/protocol/authentication and actual persistence SQL in
embedded Postgres. Live Postgres advisory-lock and proxy/browser deployment smoke
tests remain required.

### Home dashboard

The home page reads the signed-in player's current rating, consecutive wins and five latest completed duels from Postgres. A draw or loss ends the win streak. Daily challenges rotate deterministically at UTC midnight using published problems only; solutions, generators and hidden tests never enter the page data. Empty catalogs and unavailable services have explicit UI states.

Play connects to the same-origin `/matchmaking` WebSocket endpoint using the session cookie. Run the matchmaking worker and configure the documented reverse proxy for that path. The client displays server wait updates, supports cancelling a search and requires an explicit retry after connection failure. It displays recovered/reserved tickets until the match screen and activation service are implemented; ranked play still needs the validated catalog and lifecycle work.

Leaderboard: `/leaderboard` shows the top 100 current ratings, including new accounts.
`/leaderboard?period=weekly` ranks net rating gain from completed duels since Monday
00:00 UTC, using match completion time and excluding future matches. Only players
with qualifying rating-history rows appear. Equal full-precision scores share a
rank (1, 1, 3); usernames provide stable ordering within ties. Display values are
rounded. Both views are public and never return credentials or problem internals.
Friends filtering awaits friend relationships (tracked in GOAL.md).

## Public player profiles
`/profile/<username>` shows current rating, all-time completed match record, the last 20 completed matches and a graph of the last 50 rated duels. Lookup is case-insensitive; unknown players return 404. Future-dated and unfinished matches are excluded. Profiles expose no credentials, source code, hidden tests or solutions. Graph points follow match order, with expandable dated rating data; missing rating history is labeled Unrated.

Tier thresholds use unrounded current MMR: Bronze below 1000, Silver 1000, Gold 1200, Platinum 1600, Diamond 2000, Master 2400. These display tiers do not change matchmaking difficulty bands.

## Problem pipeline

Author original problem JSON drafts, then use `npm run problems -- validate path/to/draft.json` or `npm run problems -- publish path/to/draft.json`. Validation compares reference and brute-force implementations on 2,000 deterministic random small inputs inside Judge0, checks authored examples and hidden outputs, and requires brute force to CPU-timeout on every largest-input benchmark. Publishing revalidates and inserts an immutable published suite. See [the authoring guide](problems/README.md) for the schema, limits and sandbox setup. No local Python execution or sandbox fallback exists.

### Friends

Apply database migrations (`npm run db:migrate`) to create the friendships table. Signed-in players can send requests by username at `/friends`, accept or decline incoming requests, cancel outgoing requests, and remove friends. Reciprocal requests require explicit acceptance. `/leaderboard?scope=friends` and `/leaderboard?scope=friends&period=weekly` rank the current player and accepted friends within that circle. Weekly eligibility and UTC boundaries match the public leaderboard. Requests use the existing session and same-origin POST protection.
