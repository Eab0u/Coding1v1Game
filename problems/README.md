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
