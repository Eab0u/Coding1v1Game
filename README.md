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

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Vitest tests the entry page in jsdom and executes the actual SQL migration in PGlite (embedded Postgres). Tests need neither Docker nor an external database and never execute player code. Judge service tests mock the Judge0 HTTP boundary; live sandbox verification remains pending.

## Database

`db/migrations` contains ordered SQL migrations for users, problems, matches, submissions and rating history. `npm run db:migrate` applies pending migrations in one transaction, records them in `schema_migrations`, and uses a transaction advisory lock to serialize concurrent runs. Run it again safely after adding migrations; do not edit migrations already applied to a shared database.

Hidden tests, solutions, and submitted source are server-only data. No public database API is exposed. The schema records the median CPU time on large tests; the judge adapter supplies three independent benchmark CPU samples for scoring. Authentication, participant authorization and match lifecycle enforcement belong to the future server implementation.

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

