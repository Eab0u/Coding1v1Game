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

The pipeline intentionally has no published seed catalog yet. Problems 1–20 and real sandbox validation remain separate backlog work. Unit tests mock sandbox results and exercise SQL with embedded Postgres; they do not execute Python. Before enabling ranked play, smoke-test CPU limits, network isolation and memory enforcement on the actual sandbox deployment.
