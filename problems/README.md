# Authoring and publishing problems

Only use original statements and solutions. Keep drafts and generated hidden tests on the server; do not import this directory into client code.

Save your authored draft as a JSON file. Run `npm run problems -- validate path/to/draft.json` to validate without database writes. Run `npm run problems -- publish path/to/draft.json` to revalidate and atomically insert a published problem. Both commands require `.env` with an isolated Judge0 deployment (`JUDGE0_URL`, `JUDGE0_PYTHON_LANGUAGE_ID`, optional `JUDGE0_AUTH_TOKEN`). Publishing also requires `DATABASE_URL` and the existing migrations. No code is ever run locally. The command uses each draft's CPU and memory limits, rather than the environment defaults for player submissions.

Draft JSON fields:

- `slug`, `title`, `statement`, `constraints`, `functionName`, `functionSignature`, `difficulty` (`easy`, `medium`, `hard`), and nonempty `topics`.
- `examples`: objects with JSON `args`, JSON `expected`, and an `explanation`. Include these examples in the statement shown to players as well.
- `referenceSolution` and `bruteForceSolution`: Python source defining the named function. The brute force must be correct on small inputs and CPU-timeout on every large benchmark. Crashes, wrong answers and infrastructure failures do not qualify as timeouts.
- `generator`: `seed` (unsigned 32-bit integer) and `args` specifications. An argument can be `{ "kind": "integer", "min": 0, "max": 10 }` or `{ "kind": "integer-array", "min": -10, "max": 10, "minLength": 0, "maxLength": 20 }`. Values are bounded to ±1,000,000; random arrays are limited to 50 entries. This initial declarative generator supports integer/array problems; extend it with tests for other problem families. It never evaluates author-supplied JavaScript or Python on the host.
- `tests`: 2–100 JSON `{ "args": [...], "expected": ... }` cases, including ordinary edge cases and at least one largest-input case marked `"benchmark": true`. Large inputs and expected outputs are authored explicitly in JSON; their bounds should exercise the stated complexity. The reference must pass all authored cases. Brute force must pass examples and ordinary cases.
- `cpuLimitMs` (100–30,000), `memoryLimitKb` (16,384–262,144).

The seeded generator produces 2,000 small inputs. Reference and brute force run in separate Python namespaces with independent argument copies and must agree on every input. Batches of 100 comparisons run through the sandbox; benchmark runs are repeated three times by the judge. Authored expected outputs also guard against two implementations sharing the same bug. Authors remain responsible for mathematical correctness and coverage of boundary cases.

After successful validation, publication inserts all public metadata, private solutions, generated-test specification, a SHA-256 draft digest, validation version/count and the example/hidden suite in one statement. Slugs are immutable: an existing slug causes an error, preserving suites already used by matches. Publish revisions under new slugs. There is no cached validation approval to reuse after changing a draft. A failed validation or unavailable sandbox produces no database write.

The pipeline has no published catalog yet; the original drafts below are awaiting sandbox validation. Problems 1–20 and real sandbox validation remain separate backlog work. Unit tests mock sandbox results and exercise SQL with embedded Postgres; they do not execute Python. Before enabling ranked play, smoke-test CPU limits, network isolation and memory enforcement on the actual sandbox deployment.

## Original problem drafts

### Relay Cycle Intervals

`drafts/relay-cycle-intervals.json` is an original medium prefix-remainder
problem: count nonempty contiguous intervals whose signed sum is divisible
by a positive cycle length. Zero and negative multiples count. Equal prefix
remainders identify balanced intervals; seed the empty prefix and count before
inserting the current prefix. The reference uses O(n) expected time and O(n)
space. The baseline enumerates every interval in O(n^2) time and O(1) space.

The generator supplies 2,000 seeded signed inputs. Fixtures cover unit cycles,
negative sums, zeroes, missing intervals and signed bounds. Three 100,000-entry
benchmarks use zeroes, ones with no qualifying interval, and alternating signed
multiples. Each requires 5,000,050,000 baseline visits; two answers exceed 32 bits.
Data-only tests compare enumeration with a sorted prefix-residue pairing identity,
check reversal, negation and adding a cycle to each value, and verify large-case
formulas. They never execute Python or establish sandbox approval.

The proposed 1-second CPU and 64-MiB limits require isolated measurement. This
draft remains private and unpublished until full sandbox validation succeeds:

```sh
npm run problems -- validate problems/drafts/relay-cycle-intervals.json
npm run problems -- publish problems/drafts/relay-cycle-intervals.json
```

### Delayed Drop Pairs

`drafts/delayed-drop-pairs.json` is an original medium divide-and-conquer
problem: count earlier/later signal pairs whose drop strictly exceeds a
nonnegative tolerance. Equal-to-tolerance differences are excluded; sorting
the entire input before counting would lose the required time order.

The reference recursively counts within each time half, then counts crossing
pairs with a monotone pointer over the sorted halves before merging them.
This takes O(n log n) time and O(n) peak auxiliary space. The brute force
checks all n(n-1)/2 position pairs, taking O(n^2) time and O(1) space.
The seeded generator supplies 2,000 small cases. Fixtures cover ties, signed
boundaries, zero tolerance, exact thresholds and shared endpoints.

Three 100,000-tick benchmarks use descending, constant and split high/low
levels. Each requires 4,999,950,000 brute-force comparisons; the descending
and split answers exceed signed 32-bit range. Data-only tests enumerate
small answers, compare an independent ordered-prefix identity and check
translation invariance, tolerance monotonicity and large-case formulas.

Neither Python solution runs locally. The proposed 1-second CPU and 64-MiB
limits require isolated sandbox measurement. This private draft remains
unpublished until full validation succeeds:

```sh
npm run problems -- validate problems/drafts/delayed-drop-pairs.json
npm run problems -- publish problems/drafts/delayed-drop-pairs.json
```

These are private authoring inputs, outside the site's public assets. No draft is
approved for ranked play until the sandbox pipeline passes and publishes it.

### Signal Rise Debt

`drafts/signal-rise-debt.json` is an original medium monotonic-stack problem.
Each tick contributes its distance to the first strictly greater later signal,
or zero if none exists. Equal levels stay unresolved. The reference stores
unresolved indices in a nonincreasing stack: each index is pushed and popped
at most once, giving O(n) time and O(n) space. The O(n^2) brute force scans
forward independently for each tick and stops at its first greater level.

The seeded generator supplies 2,000 small cases with signed levels and ties.
Authored fixtures exercise first-versus-largest confusion, equal plateaus,
unresolved suffixes, singletons and boundary levels. Three 100,000-tick
benchmarks use descending levels, equal levels and a descending prefix with
one final maximum. Each requires 4,999,950,000 brute-force comparisons;
the final-rise answer also exceeds signed 32-bit range.

Data-only tests independently enumerate small answers and derive the large
answers from their structure. They do not execute either Python solution or
establish timeout behavior. The proposed 1-second CPU and 64-MiB limits need
measurement in the isolated sandbox. This draft remains private and unpublished:

```sh
npm run problems -- validate problems/drafts/signal-rise-debt.json
npm run problems -- publish problems/drafts/signal-rise-debt.json
```

### Relay Balance Window

`drafts/relay-balance-window.json` is an original medium prefix-sum problem. A
quadratic solution enumerates every consecutive window. The reference keeps the
earliest index of each prefix sum, giving O(n) time and O(n) space. Keeping the
earliest occurrence matters: later occurrences can hide a longer valid window.
Negative adjustments prevent a positive-only sliding window approach.

The seeded generator supplies 2,000 small comparisons in the existing pipeline.
Authored cases include absent windows, singletons, zero targets, repeated prefix
sums, negative targets and boundary values. Three 100,000-element benchmarks
exercise no-solution input, repeated prefixes and prefix sums beyond 32-bit range.
Each requires about five billion window visits from the supplied brute force.

Fixture tests check data shape, expected values and case coverage without executing
either Python solution. They do **not** establish Python correctness, CPU timeout
behavior or sandbox isolation. The proposed 1-second CPU and 64-MiB limits still
require measurement on the isolated deployment.

Once Judge0 connectivity is restored, run:

```sh
npm run problems -- validate problems/drafts/relay-balance-window.json
npm run problems -- publish problems/drafts/relay-balance-window.json
```

Both commands perform full sandbox validation; publication also requires Postgres.
Never publish through direct SQL or treat mocked runner results as approval.

### Channel Budget Windows

`drafts/channel-budget-windows.json` is an original medium sliding-window
problem: count nonempty contiguous intervals using at most a given number of
distinct channels. Duplicate readings consume one channel slot.

The reference maintains a frequency map and moves the left endpoint until the
budget holds, then counts every valid suffix ending at the right endpoint.
Each endpoint moves at most n times: O(n) expected time and O(n) space. The
O(n^2) brute force builds a set for each left endpoint and visits all right
endpoints, including invalid windows. Its lack of early termination deliberately
keeps all three benchmarks useful for timeout validation.

The generator supplies 2,000 seeded small arrays and budgets. Fixtures cover
singletons, repeated channels, signed boundary values, oversized budgets and
repeated shrinking. Three 100,000-element benchmarks use equal, unique and
three-channel cycling records; their expected totals follow closed-form counts.
The equal-channel answer exceeds signed 32-bit range. The supplied brute force
visits 5,000,050,000 windows per benchmark.

Data-only fixture tests independently enumerate small intervals and verify
reversal invariance, budget monotonicity and large-case formulas. Neither Python
solution runs locally. The proposed 1-second CPU and 64-MiB limits require
measurement in isolated Judge0; correctness and timeout approval remain pending.
The draft is private and unpublished. Once connectivity is restored, run:

```sh
npm run problems -- validate problems/drafts/channel-budget-windows.json
npm run problems -- publish problems/drafts/channel-budget-windows.json
```

### Spaced Beacon Pairs

`drafts/spaced-beacon-pairs.json` adds an original easy counting problem: count
pairs of equal channels separated by at least one tick. Positions, rather than
channel values, distinguish pairs; adjacent equal values are excluded.

The reference adds the channel two positions behind to an eligible frequency
map before counting each right endpoint: O(n) time and O(n) space. The brute
force visits every nonadjacent pair in O(n^2) time and O(1) extra space.
The seeded generator provides 2,000 small signed-channel inputs. Authored cases
cover singletons, adjacent duplicates, shared endpoints, zero and boundary values.
Three 100,000-tick benchmarks cover all-equal, alternating and all-distinct
channels, each requiring 4,999,850,001 brute-force comparisons. Dense answers
exceed signed 32-bit range.

Data-only fixture tests use an independent identity (all equal pairs minus equal
neighbors) and verify that identity against enumeration on generated small cases.
They do not execute or approve either Python implementation. The proposed
1-second CPU and 64-MiB limits require isolated sandbox measurement. This draft
is private and unpublished, pending full validation:

```sh
npm run problems -- validate problems/drafts/spaced-beacon-pairs.json
npm run problems -- publish problems/drafts/spaced-beacon-pairs.json
```

### Buffered Signal Gain

`drafts/buffered-signal-gain.json` is an original easy array/greedy problem:
maximize the signed gain between two ordered readings with at least one tick
between them. Exactly one pair is required, so decreasing records have negative
answers. Examples expose adjacent-pair, optional-selection and ordering errors.

The reference tracks the smallest eligible earlier reading in O(n) time and O(1)
space. The O(n^2) baseline enumerates all valid pairs. The generator supplies
2,000 seeded small signed arrays. Fixtures include mandatory losses, duplicates,
single valid pairs and both signed bounds. Three 100,000-reading benchmarks are
rising, falling and flat; their answers are 99,999, -2 and 0 respectively, and
each requires 4,999,850,001 baseline comparisons.

Data-only tests compare exhaustive enumeration with an independent reverse
suffix oracle, verify translation, positive scaling and reverse-negation
invariance, and check benchmark formulas. Neither Python solution executes on
the host. The proposed 1-second CPU and 64-MiB limits still require isolated
sandbox measurement; this private draft is unpublished and unapproved.

```sh
npm run problems -- validate problems/drafts/buffered-signal-gain.json
npm run problems -- publish problems/drafts/buffered-signal-gain.json
```

### Relay Cooldown Score

`drafts/relay-cooldown-score.json` is an original easy dynamic-programming
problem: maximize the sum of scores at nonneighboring ticks. Choosing nothing
is permitted, scores may be negative, and the record is a line rather than a
ring. Examples distinguish this rule from choosing the single largest score,
forcing a negative selection, or treating the endpoints as neighbors.

The reference tracks the best totals through the previous two prefixes in O(n)
time and O(1) extra space. The O(n^2) baseline stores the best score ending at
each tick and scans all compatible earlier endpoints, including on negative
records. Its three 100,000-tick benchmarks each require 4,999,850,001 predecessor
comparisons. All-positive and alternating-sign records earn 50,000,000,000;
all-negative records earn zero. The proposed 1-second CPU and 64-MiB limits
still need isolated sandbox measurement.

The seeded generator supplies 2,000 small signed records. Data-only fixture
tests compare exhaustive choices to an independent idle/active state oracle,
check reversal and positive scaling, and verify benchmark formulas. These tests
do not run either Python solution or establish sandbox approval. The draft
remains private and unpublished. Once isolated Judge0 is available, run:

```sh
npm run problems -- validate problems/drafts/relay-cooldown-score.json
npm run problems -- publish problems/drafts/relay-cooldown-score.json
```

### Beacon Horizon Wait

`drafts/beacon-horizon-wait.json` adds an original medium monotonic-stack
problem: sum distances to each beacon's first strictly taller beacon on its
right. Equal heights do not qualify and missing successors contribute zero.

The reference resolves pending indices with a decreasing stack in O(n) time
and O(n) space. The quadratic baseline scans forward until a taller beacon is
found. Three 100,000-element benchmarks (flat, descending, and a flat prefix
with one taller final beacon) each require 4,999,950,000 baseline comparisons.
The final case's answer exceeds signed 32-bit range.

The seeded generator supplies 2,000 small inputs. Data-only fixture tests
compare enumeration to an independent reverse successor-jump oracle, check
strictly increasing height transformations, and verify full-size formulas.
These checks do not execute either Python solution. The proposed 1-second CPU
and 64-MiB limits need isolated Judge0 measurement. The draft is private,
unpublished and unapproved. Once sandbox connectivity is restored, run:

```sh
npm run problems -- validate problems/drafts/beacon-horizon-wait.json
npm run problems -- publish problems/drafts/beacon-horizon-wait.json
```

### Relay Balanced Cuts

`drafts/relay-balanced-cuts.json` is an original easy prefix-sum problem:
count internal gaps whose nonempty left and right portions have equal signed
sums. Entries are never removed. Zero totals and repeated qualifying gaps count;
a singleton has no legal cut.

The reference computes the total and scans internal prefix sums in O(n) time
and O(1) extra space. A cut qualifies exactly when twice its prefix equals the
total. The O(n^2) baseline resums both portions at each gap, performing
9,999,900,000 additions for each 100,000-entry benchmark. All-zero, constant
positive and alternating-sign records have respectively 99,999, 1 and 49,999
balanced cuts. The constant case also catches narrow intermediate sums.

The generator supplies 2,000 seeded signed small cases. Data-only tests compare
explicit left/right sums with a signed-balance walk, check reversal and nonzero
scaling invariants, and verify fixture and benchmark answers. They never execute
draft Python. The proposed 1-second CPU and 64-MiB limits need isolated sandbox
calibration. This draft remains private, unpublished and unapproved. Run:

```sh
npm run problems -- validate problems/drafts/relay-balanced-cuts.json
npm run problems -- publish problems/drafts/relay-balanced-cuts.json
```

### Relay Floor Repair

`drafts/relay-floor-repair.json` is an original easy greedy/prefix-maximum
problem: increase signed log levels until they are nondecreasing, minimizing
unit increments. Equal neighbors are allowed; decreases and reordering are not.
Every repaired entry must be at least the original prefix maximum. Choosing
exactly that maximum attains this lower bound, proving the greedy solution.
The reference carries that maximum in O(n) time and O(1) space. The quadratic
baseline scans each prefix, performing 5,000,050,000 iterations per full-size
benchmark. Constant, descending and alternating-extreme fixtures have costs
0, 4,999,950,000 and 100,000,000,000, respectively.

Data-only tests compare prefix enumeration with unit-by-unit repairs on 2,000
seeded small cases, check translation, positive scaling and sorted-input
invariants, and verify full-size formulas. No authored Python executes locally.
The proposed 1-second CPU and 64-MiB limits need isolated Judge0 calibration,
reference/baseline agreement and baseline timeouts. This draft remains private,
unpublished and unapproved for ranked play. Run:

```sh
npm run problems -- validate problems/drafts/relay-floor-repair.json
npm run problems -- publish problems/drafts/relay-floor-repair.json
```

### Relay Parity Streak

`drafts/relay-parity-streak.json` is an original easy array/dynamic-programming
problem: find the longest contiguous section with alternating even and odd
levels. Negative integers and zero are supported; singleton streaks are valid.

The reference tracks the longest valid suffix: extend it on a parity change,
otherwise reset to one. Every valid section ends at some index, so the maximum
of these suffix lengths is optimal. This takes O(n) time and O(1) extra space.
The baseline extends a fresh streak from every start, taking quadratic time on
alternating input. Two fully alternating 100,000-entry benchmarks return
100,000; a central parity break returns 50,000 and still forces billions of
baseline comparisons. The seeded generator provides 2,000 small cases.

Data-only tests compare exhaustive section checks with independent boundary
partitioning and verify reversal, negation, parity flipping, odd scaling and
duplicate-append invariants. Python is never executed locally. Proposed
1-second CPU and 64-MiB limits require isolated sandbox calibration, Python
reference/baseline agreement and three baseline timeouts per benchmark.
This draft remains private, unpublished and unapproved. Validate with:

```sh
npm run problems -- validate problems/drafts/relay-parity-streak.json
```

### Relay Prefix Diversity

`drafts/relay-prefix-diversity.json` is an original easy array/hash-set problem:
sum the number of distinct channel IDs in every nonempty prefix of a log.
Repeated, zero and negative IDs are ordinary values; order matters.

The reference maintains a set and accumulates its size in O(n) expected time
and O(n) space. The quadratic baseline reconstructs each prefix set, requiring
5,000,050,000 insertions on each 100,000-entry benchmark. Constant, all-distinct
and alternating logs have answers 100,000, 5,000,050,000 and 199,999 respectively.
The distinct benchmark catches answers exceeding signed 32-bit range.

The generator supplies 2,000 seeded small cases. Data-only tests compare prefix
enumeration with independent first-occurrence contributions: an ID first seen
at zero-based index i contributes n-i. Tests also check injective renaming,
appending an existing ID, fixture answers and full-size formulas. No draft
Python executes locally. Proposed 1-second CPU and 64-MiB limits need isolated
Judge0 calibration, reference/brute-force agreement and baseline timeouts.
This draft remains private, unpublished and unapproved. Run:

```sh
npm run problems -- validate problems/drafts/relay-prefix-diversity.json
npm run problems -- publish problems/drafts/relay-prefix-diversity.json
```

### Relay Order Conflicts

`drafts/relay-order-conflicts.json` is an original medium sorting problem:
count strictly decreasing pairs of priority levels in arrival order. Equal
levels do not conflict; negative levels and nonadjacent pairs are supported.

The reference recursively sorts each half and counts cross-half conflicts
while merging. When a right value precedes the remaining left values, all
mid-left of those values conflict with it. Taking the left value first on
equality excludes equal pairs. Every pair belongs to exactly one recursive
split, giving O(n log n) time and O(n) auxiliary space. The baseline examines
all n(n-1)/2 pairs even on sorted or constant input.

Three 100,000-entry benchmarks cover descending, ascending and constant logs,
with answers 4,999,950,000, zero and zero. The generator supplies 2,000 seeded
small cases. Data-only tests compare pair enumeration with insertion ranks,
check increasing relabeling, append/prepend boundaries, and verify that reversal
or negation complements the answer among unequal pairs. No authored Python
executes locally. Proposed 1-second CPU and 64-MiB limits require isolated
sandbox calibration, reference/baseline agreement and three baseline timeouts
per benchmark. This draft remains private, unpublished and unapproved. Run:

```sh
npm run problems -- validate problems/drafts/relay-order-conflicts.json
```
