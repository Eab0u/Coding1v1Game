# Progress Log

The agent reads this file at the start of every run and updates it at the end.
Newest entries go at the top of the Log section.

## Current status
Match lifecycle orchestration is implemented. Apply migrations through 005_match_lifecycle.sql and run `npm run lifecycle` alongside the app and matchmaking with isolated Judge0 credentials. Both participants click Ready within 60 seconds; the server activates difficulty-scaled clocks, admits bounded submissions, judges durable jobs and atomically persists final scores, ratings and history. Best judged submissions count at the deadline. Infrastructure failures retry and delay settlement rather than scoring losses. Pending reservations expire without ratings. No catalog problems have been published; validated problems and live infrastructure smoke checks remain required before public ranked play.

The participant-only arena at /match/<id> supports locally bundled Monaco Python editing, readiness, sandbox submission, server-time countdown and polled own/opponent progress. Drafts recover after refresh using match/player-scoped browser session storage, with visible failure feedback and cleanup when the server reports the match ended. Completed arenas link to participant-only /match/<id>/results with persisted outcome, rating history and final-score snapshots. Consensual rematch invitations are available on results pages after applying migration 006_rematches.sql.

Optional duel sound and animated feedback are implemented as shared components, with match-found feedback connected to matchmaking. Sound defaults off, persists locally and unlocks through user interaction. The arena connects authoritative judged submissions to test-pass/fail cues, once per submission. Results show victory, defeat or draw feedback and offer explicit replay with optional sound; opening results does not unlock or autoplay audio.

Matchmaking fair-play basics now share command limits across account connections, throttle handshake attempts before authentication and rotate problems using both players' exposure histories. Optional paste blocking remains off until an editor exists. Worker counters reset on restart; reverse proxies need per-client handshake limits.

Friend requests and accepted friendships are available at /friends, with authenticated friends-only global and weekly standings. Apply migration 003_friends.sql before using these flows.

Mobile layout polish is implemented for the existing home, account, profile and leaderboard pages, with Chromium regression coverage for narrow phones through desktop widths. Arena and results now have responsive browser checks; Monaco interaction still needs a live deployment smoke check.

The problem pipeline is implemented: deterministic small-input generation, sandbox-only solution validation and immutable publication. The original problem catalog is still pending; no real catalog problems have been published.

Public player profiles now show rating graphs, tier badges, full win/loss/draw records and recent match history at /profile/<username>. Public global and weekly leaderboards are available at /leaderboard, linked from the home page. The home dashboard now connects signed-in players to matchmaking, displays current ratings, win streaks, recent completed duels and a published daily challenge (with honest empty states). Authenticated WebSocket matchmaking now pairs players within widening rating bands and persists recoverable pending match tickets. Username/password authentication, database-backed sessions, application foundation, design system, tested match scoring and Glicko-2 rating calculations are in place: Next.js App Router, Postgres schema, reusable UI primitives, dark theme tokens and a responsive entry page. A tested Judge0 sandbox adapter produces scorer-compatible results. Published problems and live sandbox/database deployment verification remain pending.

## Decisions made
- Python only for v1
- Stack: Next.js + TypeScript, Node WebSockets, Postgres, Judge0 or Piston for sandboxing
- Rating: Glicko-2 (Elo as a first pass is fine)
- Winner order: most tests passed, then runtime on largest tests, then earlier submit time
- Node 24 and npm lockfile for reproducible installs; GitHub Actions runs tests, lint, typecheck and production build.
- SQL migrations are transactional and tracked in Postgres. PGlite executes schema tests without an external database.

## Blockers
- Problems 1-20 passing validation and problems 21-60 require an isolated Judge0 deployment; this workspace has only .env.example and no configured sandbox. Catalog validation remains blocked.
- Docker daemon is not running in this environment, so Docker Postgres startup and the network migration runner were not exercised. The SQL itself passes embedded Postgres tests.
- npm audit reports 8 moderate development dependency findings through typescript-eslint/minimatch; no production dependency findings. Revisit when upstream tooling updates; no forced major downgrade applied.

## Next up
Configure an isolated Judge0 instance and author/validate problems 1?20 to enable pairing. Smoke-test migrations, the lifecycle worker, real Postgres concurrent settlement and sandbox isolation/resource enforcement before public ranked play. Live rematch and concurrent matchmaking smoke checks follow.

## Log
### 2026-11-06 - Immediate rematch read recovery
- Reviewed the two unchecked catalog items; both remain blocked by the missing isolated Judge0 deployment. Only .env.example is available. Added and completed one independent recovery and visual polish item; catalog tasks remain unchecked.
- Failed invitation reads now show an accented recovery panel with an immediate Retry invitation update action. Refreshing is announced accessibly; retries are disabled during reads and invitation actions. Automatic retries continue, successful reads clear the panel, and terminal states retain their existing next actions.
- Added regression tests for immediate retry, duplicate clicks, no overlapping scheduled reads, repeated failure, successful recovery, resumed polling and navigation abort with stale-response protection.
- Validation: all 389 tests across 41 files, lint, typecheck, production build and diff whitespace checks passed. No player code executed.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database, WebSocket and sandbox deployment smoke checks remain pending.

### 2026-11-06 - Rematch action confirmation feedback
- Reviewed both unchecked catalog items; validation remains blocked by the missing isolated Judge0 deployment (only .env.example is present). Added and completed one independent rematch interaction and visual polish item; catalog items remain unchecked.
- Sending, accepting, declining and cancelling invitations now display distinct accessible status messages in an accented panel until the server responds. Controls remain disabled during requests; confirmed state replaces pending feedback, and failures restore controls for retry with the existing error message.
- Added five regression cases covering each action's pending message, disabled controls, duplicate-click protection, failure recovery and successful invitation confirmation. Existing stale-response and navigation-abort tests remain passing.
- Validation: all 387 tests across 41 files, lint, typecheck, production build and diff whitespace checks passed. No player code executed.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database, WebSocket and sandbox deployment smoke checks remain pending.

### 2026-11-06 - Settled rematch feedback and polling cleanup
- Reviewed both unchecked catalog items; isolated Judge0 validation remains blocked because only .env.example is available. Added and completed one independent rematch efficiency and visual polish item; catalog items remain unchecked.
- Rematch reads now stop after the server reports accepted, declined, cancelled or expired, including terminal POST responses. This avoids repeating transactional database reads and match-row locks for immutable invitation outcomes. Pending and absent invitations still poll, failed requests retain retry behavior, and changing matches starts a fresh session.
- Added distinct accessible terminal messages, a styled settled panel and a direct Find a new opponent action for declined, cancelled and expired invitations. Accepted invitations retain their arena link. Successful actions clear stale refresh errors.
- Added six regression cases covering all terminal states, next-action links, terminal action responses, match changes and server-reported expiry after pending refreshes.
- Validation: all 382 tests across 41 files, lint, typecheck, production build and diff whitespace checks passed. No player code executed.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database, WebSocket and sandbox deployment smoke checks remain pending.

### 2026-11-06 - Working friend actions and organized relationship sections
- Reviewed both unchecked catalog items; isolated Judge0 validation remains blocked because only .env.example is available. Added and completed one independent friends-flow repair and visual polish item; catalog items remain unchecked.
- Fixed Accept, Decline, Cancel request and Remove friend buttons: the shared Button defaults to type="button", so these controls previously never submitted. Each now explicitly submits its existing authenticated POST form with the selected action and player.
- Split the circle into accessible Incoming requests, Your friends and Sent requests sections, with accurate counts, incoming-first ordering, semantic player lists, named action forms and styled empty states. Existing server authorization and consent rules remain in effect.
- Added regression coverage for actual submit events, clicked submitters, player/action payloads, section membership/counts, empty states and guest privacy. Extended Chromium layout checks to populated friends at 320/375/768/1280px, including long names and touch target sizes.
- Validation: all 376 tests across 41 files, lint, typecheck, production build and diff whitespace checks passed. No player code executed.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database, WebSocket and sandbox deployment smoke checks remain pending.

### 2026-11-06 - Bounded matchmaking reservation recovery
- Reviewed both unchecked catalog items; isolated Judge0 validation remains blocked because only .env.example is available. Added and completed one independent matchmaking reliability and usability item; catalog items remain unchecked.
- Reservation confirmation now has a fixed ten-second deadline. Missing confirmation closes the connection and enables retry with explicit guidance that a reserved match may need recovery. Repeated matching frames and stale queued frames cannot renew the deadline or restore cancellation while reservation is underway. Late frames from abandoned connections cannot replace a recovered ticket.
- Play buttons now distinguish connecting, searching, reserving and cancelling. Cancellation explicitly waits for server confirmation in the accessible status message.
- Added regression tests for missing confirmation, repeated/out-of-order frames, late abandoned reservations, successful recovery, confirmation cleanup and unmount cleanup. All 374 tests across 41 files, lint and production build passed. No player code executed.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database, WebSocket and sandbox deployment smoke checks remain pending.

### 2026-11-06 - Account password visibility controls
- Reviewed both unchecked catalog items; isolated Judge0 validation remains blocked because only .env.example is available. Added and completed one independent account usability and visual polish item; catalog items remain unchecked.
- Added separate Show/Hide controls to sign-in and sign-up. Passwords start masked; toggling preserves input, password-manager autocomplete, form validation and focus without submitting. Native buttons expose the controlled field and pressed state, with distinct accessible names for each form.
- Styled the input and toggle as a compact responsive row. Added regression coverage for independent visibility, retained values, submitted form data, focus and accidental-submit prevention. Existing Chromium coverage checks guest account overflow and minimum touch heights at 320/375/768/1280px.
- Validation: all 372 tests across 41 files passed; lint, typecheck, production build and diff whitespace checks passed. No player code executed.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Existing live database, WebSocket and sandbox deployment smoke checks remain pending.

### 2026-11-06 - Account player hub and direct matchmaking
- Reviewed both unchecked catalog items; isolated Judge0 validation remains blocked because only .env.example is available. Added and completed one independent account usability and visual polish item; catalog items remain unchecked.
- Replaced the obsolete signed-in matchmaking placeholder with the shared Play flow, a prominent current rating and scoring guidance. Added a responsive player hub with profile, friends and leaderboard links, keeping sign-out available. The Play flow supports cancellation, connection recovery and reserved arena navigation using the existing component.
- Updated account tests for authenticated navigation, rounded ratings, guest/service-error boundaries and joining matchmaking through reservation recovery. Existing Chromium coverage exercises the updated account at 320/375/768/1280px, checking overflow and touch target heights.
- Validation: all 371 tests across 41 files passed; lint, typecheck, production build and diff whitespace checks passed. No player code executed. Live database, WebSocket and sandbox deployment smoke checks remain pending.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60; retain the existing infrastructure smoke checks before public ranked play.

### 2026-11-06 - In-flight arena action feedback
- Reviewed both unchecked catalog items; only .env.example is available, so isolated Judge0 validation remains blocked. Added and completed one independent arena usability and visual polish item; catalog items remain unchecked.
- Ready and Submit now show an atomic polite acknowledgement message in a bordered panel during requests, and the relevant button exposes its busy state. Submission guidance explains that edits made during the request are not included. Pending feedback replaces old success/error text until acknowledgement or failure arrives.
- Kept the editor available and existing duplicate-request guards intact. Added regressions for both actions covering delayed acknowledgement, concurrent polling, duplicate clicks, retained edits, failure cleanup, retry and successful acknowledgement.
- Validation: all 370 tests across 41 files passed; lint, typecheck, production build and diff whitespace checks passed. No player code executed. Live browser and screen-reader inspection remains pending.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Existing database and sandbox deployment smoke checks remain pending.

### 2026-11-06 - Clear latest-submission judging states
- Reviewed both unchecked catalog items; only .env.example is available, so isolated Judge0 validation remains blocked. Added and completed one independent arena clarity and visual polish item; catalog items remain unchecked.
- Replaced the generic judging sentence with a bordered, accessible latest-submission panel. Queued attempts explain the worker wait, running attempts explain judging, infrastructure errors show an amber retry state, and judged attempts show the final test count. Partial worker counts stay hidden until judging completes. Unknown states receive neutral checking guidance.
- The atomic polite status follows authoritative snapshots and identifies the latest recorded attempt separately from best progress and unsent edits. It remains visible in completed arenas and uses no animation or focus changes.
- Added regressions covering queued/running/error/retry/judged transitions, absent submissions, hidden partial counts, retry styling cleanup, completed-match visibility, retained edits and unchanged best progress.
- Validation: all 368 tests across 41 files passed; lint, typecheck, production build and diff whitespace checks passed. No player code executed. Live browser and screen-reader inspection remains pending.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Existing database and sandbox deployment smoke checks remain pending.

### 2026-11-06 - Keyboard-accessible solution reset confirmation
- Reviewed both unchecked catalog items; only .env.example is available, so isolated Judge0 validation remains blocked. Added and completed one independent editor usability item; catalog items remain unchecked.
- Reset confirmation now focuses the safe Keep my solution action. Cancelling by button or Escape restores focus to Reset to starter code without changing the draft. Confirming returns focus to the named solution editor group, avoiding focus loss when the confirmation disappears and Reset becomes disabled. Existing visible focus styling applies, and ordinary Tab navigation remains available.
- Added regressions for both editor modes covering initial focus, button cancellation, Escape from the destructive action, preserved drafts, confirmed replacement and focus recovery.
- Validation: all 366 tests across 41 files passed; lint, typecheck and production build passed. No player code executed. Live browser and screen-reader inspection remains pending.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Existing database and sandbox deployment smoke checks remain pending.

### 2026-11-06 - Final-minute arena warning
- Reviewed both unchecked catalog items; only .env.example is available, so isolated Judge0 validation remains blocked. Added and completed one independent arena usability item; catalog items remain unchecked.
- Added an amber clock and bordered final-minute message reminding players to submit their latest edits. The polite, atomic status text stays constant as seconds tick, avoiding per-second announcements. It follows the existing server-based countdown and polling corrections, disappears at expiry or match completion, and uses no animation or focus changes.
- Added regressions for the exact 60-second boundary, stable warning text, submission availability, expiry, retained edits, non-active matches, authoritative clock corrections and completed results.
- Validation: all 362 tests across 41 files passed; lint, typecheck, production build and diff whitespace checks passed. No player code executed. Live visual and screen-reader inspection remains pending.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Existing database and sandbox deployment smoke checks remain pending.

### 2026-11-06 - Plain-text editor cursor position
- Reviewed the unchecked catalog items; only .env.example is available, so isolated Judge0 validation remains blocked. Added and completed one independent editor usability item; catalog items remain unchecked.
- Added a styled cursor position strip showing one-based line/column and selected UTF-16 code units. It follows the active selection end, keyboard and pointer movement, indentation edits, external replacements and completed read-only code. Tabs occupy one code unit for column counting.
- Associated the strip with the editor for accessibility without live announcements on every keystroke. Position updates do not rerender the editor or change code, focus or selection.
- Added regressions for forward/backward selections, trailing newlines, tabs, automatic and block indentation, read-only selections and empty external replacements. Fixed selection-direction event handling and avoided introducing an extra live status region.
- Validation: all 357 tests across 41 files passed; lint, typecheck, production build and diff whitespace checks passed. No player code executed. Live browser visual inspection remains pending.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Existing database and sandbox deployment smoke checks remain pending.

### 2026-11-06 - Submit from the solution editor keyboard
- Reviewed both unchecked catalog items; only .env.example is present, so isolated Judge0 validation remains blocked. Added and completed one independent arena usability item; catalog items remain unchecked.
- Ctrl+Enter and Command+Enter now submit current code from advanced and plain-text editors. Added visible shortcut guidance and accessible shortcut metadata on Submit. Editor capture handling prevents the keystroke from inserting a newline or invoking editor commands.
- Shortcuts use existing admission and in-flight guards. Added regressions for both editors, current source, duplicate requests, non-editor focus, ordinary Enter, extra modifiers, key repeat, IME composition, invalid source, reservation/completed/cancelled states and expired clocks.
- Validation: all 354 tests across 41 files passed; lint, typecheck, production build and diff whitespace checks passed. No player code executed. Live Monaco/browser deployment smoke checks remain pending.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Your best judged arena progress
- Reviewed both unchecked catalog items; only .env.example is available, so isolated Judge0 validation remains blocked. Added and completed one independent arena clarity improvement; catalog items remain unchecked.
- Arena snapshots now project the participant's best judged test count separately from the latest submission. Added an accessible green progress bar beside the editor, with empty-state guidance and an explanation that the score does not confirm submission of current edits.
- Added embedded database coverage for participant isolation, zero-pass scores, stronger scores and later weaker, failed, running or incomplete attempts. UI coverage verifies polling updates, latest-versus-best scores, unsent edits, accessible labels/descriptions and completed matches. Updated existing selectors to distinguish both players' progress bars.
- Validation: all 347 tests across 41 files passed; lint, typecheck, production build and diff whitespace checks passed. No player code executed. Live deployment visual inspection remains pending.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Submission size guidance and admission validation
- Reviewed the two unchecked catalog items; only .env.example is present, so isolated Judge0 validation remains blocked. Added and completed one independent arena usability item; catalog items remain unchecked.
- Added a styled source-limit panel with exact character-unit counts, accessible validation feedback and guidance for symbols that occupy two UTF-16 units. Blank or oversized code disables Submit; reducing code to the limit restores submission. Ready remains independent of source validity.
- Shared source validation between the arena and lifecycle admission, including an action-handler guard. Oversized recovered drafts remain intact and available for editing, copying and downloading; no code is truncated.
- Added regressions for whitespace, exact/over-limit source, Unicode counting, recovered drafts, accessible button descriptions, export availability, valid submission and server persistence boundaries.
- Validation: all 346 tests across 41 files passed; lint, typecheck and production build passed. No player code executed. Live deployment visual inspection remains pending.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Best judged opponent progress
- Reviewed both unchecked catalog items; isolated Judge0 remains unconfigured (only .env.example is present). Catalog validation remains blocked and unchecked. Added and completed one independent arena correctness and clarity item.
- Opponent progress now selects the highest judged test count rather than the latest attempt, so weaker resubmissions cannot lower the displayed score. Failed, pending and incomplete verdicts do not replace valid judged progress. Own latest-submission reporting remains separate.
- Updated the progress bar label and accessible guidance to explain best correctness and the runtime/submission-time tiebreakers.
- Added embedded database regressions for weaker, failed, incomplete and stronger attempts, plus UI coverage for empty/populated accessible progress and scoring guidance.
- Validation: all 343 tests across 40 files passed; lint, typecheck and production build passed. No player code executed.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency, sandbox enforcement and deployment visual checks remain pending.

### 2026-11-06 - Reservation readiness countdown
- Reviewed both unchecked catalog items; only .env.example is available, so isolated Judge0 validation remains blocked. Added and completed one independent arena usability and visual polish item; catalog tasks remain unchecked.
- Arena snapshots now project the pending reservation expiry from the same creation-time-plus-60-seconds rule used by the lifecycle service. The scoreboard shows a green, accessible countdown using server time and monotonic elapsed time, with a fallback for snapshots without expiry data.
- Expired reservations disable Ready and explain that the server must confirm activation or cancellation. Failed polling does not extend the window or invent cancellation; code remains available. Server activation restores the duel timer and submission controls.
- Added embedded database coverage for the exact expiry and UI regressions for countdown ticks, failed polling, expiry, preserved code, authoritative cancellation and activation.
- Validation: all 342 tests across 40 files passed; lint, typecheck and production build passed. No player code executed. Live browser visual inspection remains pending.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Submission freshness guidance
- Reviewed both unchecked catalog items; only .env.example is available, so isolated Judge0 validation remains blocked. Added and completed one independent arena usability item; catalog tasks remain unchecked.
- Added a styled, accessible submission status panel distinguishing code acknowledged by the server from subsequent edits. In-flight edits remain unsent after acknowledgment; failed requests retain the previous acknowledgment. Restoring exactly the sent code restores its sent state.
- Reopened and new arenas honestly explain that this tab cannot confirm the current code's submission history. Draft saving is explicitly separate from submission. Expired clocks explain that unsent edits can still be exported, and ended matches remove the panel.
- Added regressions for in-flight editing, restoring sent code, request failure, match navigation, deadline expiry and completion.
- Validation: all 340 tests across 40 files passed; lint, typecheck and production build passed. No player code executed. Live browser visual inspection remains pending.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Expired clock and pending results guidance
- Reviewed both unchecked catalog items; only .env.example is available, so isolated Judge0 validation remains blocked. Added and completed one independent arena clarity and visual polish item; catalog tasks remain unchecked.
- Active arenas at zero now show a responsive, green-accented pending-results panel with an accessible announcement. It explains closed submissions, continued judging, possible sandbox delays and automatic checking without implying a winner or confirmed rating change.
- Code and export controls remain available. Guidance survives failed polls and disappears when the server confirms completion, revealing the existing results link.
- Added regressions for local clock expiry, reopening an expired active match, connection failure/recovery, disabled submission, preserved code/export and authoritative completion.
- Validation: all 338 tests across 40 files passed; lint, typecheck and production build passed. No player code executed. Live deployment visual inspection remains pending.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Cancelled reservation recovery
- Reviewed both unchecked catalog items; only .env.example is available, so isolated Judge0 validation remains blocked. Added and completed one independent arena recovery and visual polish item; catalog tasks remain unchecked.
- Cancelled arenas now show a responsive, green-accented recovery panel explaining reservation expiry and unchanged ratings, with a direct link home to matchmaking and guidance to copy or download visible code before leaving.
- Added regressions for initially cancelled arenas and cancellation discovered through polling, including accessible announcements, disabled submission, absent results/readiness actions and preserved code with enabled export controls.
- Validation: all 336 tests across 40 files passed; lint, typecheck and production build passed. No player code executed. Live browser visual inspection remains pending.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Reservation readiness feedback
- Reviewed both unchecked catalog items; only .env.example is available, so isolated Judge0 validation remains blocked. Added and completed one independent arena clarity and visual polish item; catalog tasks remain unchecked.
- Participant-only arena snapshots now project both readiness flags from the existing lifecycle columns, correctly swapping perspective for the second player without exposing source or private problem data.
- Added an accessible waiting panel with wrapping status badges, green confirmed states, start guidance and the reservation expiry rule. Confirmed readiness disables Ready, survives older polling responses after acknowledgment and restores from server state on reopening. Active and ended matches remove the panel; failed actions retain retry behavior.
- Extended embedded database coverage for initial flags and both participant perspectives. Added UI regressions for recovered readiness, opponent status, activation and stale polls after acknowledgment with duplicate-action prevention.
- Validation: all 334 tests across 40 files passed; lint, typecheck and production build passed. No player code executed. Live deployment readiness and visual smoke checks remain pending.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Remember editor preferences
- Reviewed both unchecked catalog items; only .env.example is available, so isolated Judge0 validation remains blocked. Added and completed one independent editor usability item; catalog tasks remain unchecked.
- The solution editor now remembers the chosen editor, text size and line wrapping in versioned browser local storage across visits, including completed matches. Preferences load after hydration and store only display settings; solution drafts retain their existing tab-scoped storage.
- Invalid stored fields independently fall back to safe defaults. Blocked storage or quota failures leave editing usable and show accessible visit-only feedback; subsequent preference changes retry saving.
- Added eight regression cases covering remount recovery, read-only matches, code exclusion, malformed JSON, invalid fields and storage read/write failures with recovery. Corrected an encoding change in the test file and a mocked-storage assertion caught by the first targeted run.
- Validation: all 332 tests across 40 files passed; lint, typecheck and production build passed. No player code executed. Live browser storage behavior remains unverified.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Explain duel scoring decisions
- Reviewed both unchecked catalog items; only .env.example is available, so isolated Judge0 validation remains blocked. Added and completed one independent results clarity and visual polish item; catalog tasks remain unchecked.
- Added an accessible, green-accented summary above the player comparison explaining the deciding rule: correctness, median benchmark CPU time, earlier submission, exact draw or neither player having a judged submission. Uses full-precision persisted metrics and checks agreement with the authoritative outcome.
- Missing historical metrics, incompatible test totals, invalid data and ambiguous no-submission timing receive an explicit unavailable explanation instead of an inferred winner. Existing final outcomes and scoring remain authoritative.
- Added regression tests for scoring priority, participant perspective, precision, draws, no submissions, missing/invalid data, contradictory outcomes and accessible results rendering.
- Validation: all 324 tests across 40 files passed; lint, typecheck and production build passed. No player code executed. Live browser visual inspection remains pending.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Immediate arena connection recovery
- Reviewed both unchecked catalog items; only .env.example is available, so isolated Judge0 validation remains blocked. Added and completed one independent arena reliability item; catalog tasks remain unchecked.
- Added a visible Retry live updates control when arena polling fails. It refreshes immediately through the existing polling chain, disables during a request and announces refresh activity. Automatic retries continue after failures. A responsive connection panel explains stale progress, draft preservation and server authority over time/results.
- Added regression coverage for immediate retry, repeated clicks, pending requests spanning polling intervals, successful progress recovery, draft preservation, repeated failures and completion discovered during retry. Match completion removes connection feedback and stops polling.
- Validation: all 308 tests across 39 files passed; lint, typecheck and production build passed. No player code executed. Live deployment connection recovery has not been manually smoke-tested.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Copy solution to clipboard
- Reviewed both unchecked catalog items; only .env.example is available, so isolated Judge0 validation remains blocked. Added and completed one independent solution preservation/usability item; catalog tasks remain unchecked.
- Added a Copy solution button shared by advanced and plain-text editors, including automatic fallback and read-only completed matches. Copies the exact current text through the browser clipboard API, announces success and gives actionable failure feedback when clipboard access is unavailable or denied.
- Disables copying while a request is pending, guards duplicate requests and hides results when the solution has changed since the copied snapshot. Supports explicit retries without changing code or editor selection.
- Added four regression cases covering both editor modes, completed matches, Unicode/newlines, missing and denied clipboard access, retries, duplicate clicks and edits during pending requests. Fixed test clipboard mocking after the first targeted run showed jsdom has no clipboard property.
- Validation: all 306 tests across 39 files passed; lint, typecheck and production build passed. No player code executed. Native browser clipboard permissions have not been manually smoke-tested.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Optional solution line wrapping
- Reviewed both unchecked catalog items; only .env.example is present, so isolated Judge0 validation remains blocked. Added and completed one independent editor readability item; catalog items remain unchecked.
- Added a keyboard-accessible Wrap long lines toggle with an announced pressed state. It shares wrapping across Monaco, plain text and automatic fallback, including read-only completed matches. Wrapping defaults off, lasts for the mounted editor session and changes display without inserting newlines into the solution. Plain text wraps even unbroken long tokens.
- Added three regression cases covering default state, toggling both ways, editor switching, unchanged code, completed matches and automatic fallback.
- Validation: all 302 tests across 39 files passed; lint, typecheck and production build passed. No player code executed. Native Monaco/browser wrapping has not been manually smoke-tested.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Adjustable solution text size
- Reviewed both unchecked catalog items. They remain blocked because no isolated Judge0 service is configured (only .env.example is present). Added and completed one independent editor readability item; catalog items remain unchecked.
- Added keyboard-accessible decrease, increase and reset controls above the solution editor. Text ranges from 12px to 24px in one-pixel increments, defaults to 15px and announces size changes politely. Controls use the existing wrapping action styling and disable at their bounds.
- Shared size state with Monaco and the plain-text editor, preserving it across editor switches and automatic fallback. Completed-match code remains read-only while text size remains adjustable. Size is scoped to the mounted editor and is not persisted after reload.
- Added four regression cases covering both modes, bounds, reset, unchanged code, switching, completed matches and automatic fallback. Fixed an ambiguous status query exposed during the initial test run by using a live span for the size indicator.
- Validation: all 299 tests across 39 files passed; lint, typecheck and production build passed. No player code executed. Live Monaco/browser interaction has not been manually smoke-tested.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Plain-text Python block indentation
- Reviewed the two unchecked catalog items; isolated Judge0 configuration is still unavailable, so both remain blocked and unchecked. Added and completed one independent editor usability item.
- Added wrapping, keyboard-accessible Indent and Outdent controls to the plain-text editor (including Monaco fallback). They adjust the current line or selected block, preserve the selected code and return focus to the editor. Indent adds four spaces; Outdent removes up to four leading spaces or one leading tab. A selection ending at the following line's start leaves that line alone. Completed-match controls are disabled; Tab retains native navigation.
- Added eight regression cases covering multiline selections, partial indentation, tabs, empty first/final lines, caret/selection restoration, unchanged outdent and read-only controls. Existing newline, draft recovery and editor tests remain passing.
- Replaced fixed browser-scroll delays with polling for the actual scroll position after a full-suite rerun exposed a timing failure. The keyboard-scroll assertions remain intact.
- Validation: all 295 tests across 39 files passed; lint, typecheck and production build passed after removing an unsupported test-query option caught by TypeScript. No player code executed. Native browser interaction for the new controls has not been manually smoke-tested.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Readable arena problem examples
- Reviewed both unchecked catalog items. They remain blocked on isolated Judge0 validation; only .env.example is available. Added and completed one independent problem-reading and visual polish item.
- Replaced raw pipeline example JSON in the arena with numbered cards showing arguments in signature order, expected output and the authored explanation. Long inputs/outputs retain separately named, focusable scroll regions. Explanations preserve line breaks and wrap long text. Legacy or malformed example shapes retain the raw display rather than crashing or dropping data.
- Added seven component regression cases for argument ordering, multiple examples, falsy/null outputs, no-argument functions, keyboard focusability, escaped markup and legacy/unavailable data. Updated Chromium arena checks to exercise actual pipeline-shaped examples, long explanations and independent input/output keyboard scrolling across four viewport widths and all match statuses.
- Validation: all 287 tests across 39 files passed; lint, typecheck and production build passed. No player code executed. Browser coverage uses rendered fixtures; live deployment checks remain pending.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Plain-text Python indentation
- Reviewed the two unchecked catalog items. Both remain blocked on isolated Judge0 validation; this workspace still has only .env.example. Added and completed one independent editor usability item.
- The plain-text editor, including automatic Monaco failure fallback, now keeps leading whitespace on Enter and adds four spaces after a colon. It replaces selected text and restores the caret after indentation. Shift+Enter provides a plain newline; Tab keeps native focus navigation. Muted, accessible keyboard guidance explains these controls.
- Added 13 regression cases covering nested indentation, tabs, selections, mid-document insertion, start-of-document boundaries, caret/focus preservation, modifier keys, IME composition, keyboard guidance and completed-match protection. Existing editor switching, recovery, draft and submission coverage also passed.
- Validation: all 280 tests across 38 files passed; lint, typecheck and production build passed. No player code executed. Native keyboard behavior has not been manually smoke-tested in a deployed browser. Indentation follows whitespace and trailing colons rather than parsing Python syntax.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Confirmed arena solution reset
- Reviewed the two unchecked catalog items; both remain blocked on isolated Judge0 validation. Added and completed one independent arena usability item, with all catalog items left unchecked.
- Added Reset to starter code in the editor action row, disabled for untouched starter code. An inline confirmation offers Keep my solution or Replace with starter code and reminds players they can download their draft first. Both editor modes restore the complete function stub. Completed/cancelled matches expose no reset controls.
- Reset uses the existing draft update path, preserving tab recovery and clearing the edited-code browser-exit warning. Added tests for both modes, confirmation/cancellation, read-only transitions, recovered-draft persistence and exit-warning cleanup.
- Validation: all 267 tests across 37 files passed; lint, typecheck and production build passed. No player code executed. Native browser interaction has not been manually smoke-tested.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Download arena solutions
- Reviewed the unchecked problems 1-20 and 21-60 items. Both remain blocked on isolated Judge0 validation; only .env.example is available. Added and completed one independent solution-preservation item.
- Added Download solution (.py) beside the editor switch in a wrapping action row. It saves the exact current draft, including Unicode and whitespace, from either editor and after match end without depending on browser draft storage. Failed downloads show retry/copy guidance. Temporary links and object URLs are cleaned up.
- Added regression coverage for exact file contents, both modes, read-only matches, URL cleanup after unmount, creation/click failures and successful retry. Fixed the test timer configuration so FileReader can complete while download cleanup remains controlled.
- Validation: all 263 tests across 37 files passed; lint, typecheck and production build passed. No player code executed.
- Limits: tests verify the browser download contract with a mocked anchor click; native save dialogs and browser download policies were not manually smoke-tested.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Protect arena drafts on browser exit
- Reviewed the unchecked problems 1-20 and 21-60 items. Both remain blocked on isolated Judge0 validation; only .env.example is available. Added and completed one independent draft-protection item.
- Edited or recovered code in pending/active arenas now registers a browser reload/tab-close warning, including when session storage fails. Returning to the starter code, receiving completed/cancelled status, changing arena sessions or unmounting removes the warning. Untouched starter code does not prompt.
- Added four regression cases covering edits/reset, navigation/unmount cleanup, both terminal statuses, recovered drafts and unavailable storage.
- Validation: all 261 tests across 37 files passed; lint, typecheck and production build passed. No player code executed.
- Limits: browser exit prompts depend on browser support and user interaction; mobile process termination may bypass them. The warning covers browser document exit, not client-side link navigation. Native prompt appearance was not manually smoke-tested.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox enforcement checks remain pending.

### 2026-11-06 - Resilient arena editor
- Reviewed the unchecked problems 1-20 and 21-60 items. Both remain blocked on isolated Judge0 validation; only .env.example is available. Added and completed one independent arena usability item.
- Players can switch between Monaco and a styled plain-text Python editor while keeping the exact current draft. The switch remains available during loading. An error boundary automatically provides plain-text editing if Monaco fails to load or render, retaining code and match-end read-only behavior. Players can switch modes to retry the advanced editor.
- Added tests for editing and switching both ways, failure recovery with the current draft, retry, read-only transitions and submission from both editor modes.
- Validation: all 256 tests across 37 files passed; the final added plain-text submission case then passed with all 21 arena UI tests (257 tests total). Lint, typecheck and production build passed. No player code executed. Live Monaco deployment smoke checks remain pending.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox isolation/resource enforcement checks remain pending.

### 2026-11-06 - Arena action request isolation
- Reviewed the unchecked problems 1-20 and 21-60 items. Both remain blocked on isolated Judge0 validation; only .env.example is available. Added and completed one independent arena reliability item.
- Ready and Submit now share a synchronous request guard, preventing duplicate actions before React updates the disabled buttons. Each request combines its timeout with a session-owned cancellation signal. Navigating to another match/player or unmounting aborts pending actions; late responses cannot update the replacement view. Failed requests release the guard for retry.
- Added regression coverage for duplicate Ready/Submit clicks, match navigation, ignored late responses, unmount cancellation, and retry after network failure.
- Validation: all 253 tests across 36 files passed; lint, typecheck and production build passed. No player code executed.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency, sandbox isolation/resource enforcement and deployment smoke checks remain pending.

### 2026-11-06 - Matchmaking acknowledgement recovery
- Reviewed the unchecked problems 1-20 and 21-60 items. Both remain blocked on isolated Judge0 validation; only .env.example is available. Added and completed one independent matchmaking reliability item.
- Open sockets now have a fresh ten-second response deadline for join and leave commands. Missing acknowledgements close the connection and restore Play with explicit retry feedback. Unconfirmed cancellation tells players to retry to recover any reservation.
- Queued/matching frames received during cancellation cannot replace the cancellation state or cancel its deadline. A concurrent reserved match remains accessible. Successful responses, send failures, socket failures, local cancellation and unmount clear timers; stale connection callbacks cannot affect a retry.
- Added regression tests for missing acknowledgements, stale frames, cancellation races, timer cleanup and synchronous send failure.
- Validation: the full suite passed (249 tests across 36 files), then the final added send-failure regression passed with all 9 Play tests (250 tests total). Lint, typecheck and production build passed. No player code executed.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency, sandbox isolation/resource enforcement and deployment smoke checks remain pending.

### 2026-11-06 - Rematch request isolation
- Reviewed the unchecked problems 1-20 and 21-60 items. Both still require isolated Judge0 validation; only .env.example is configured. Added and completed one independent rematch reliability item.
- Invitation actions synchronously invalidate earlier polls and pause polling while pending. Polling resumes after success or failure. Match changes reset invitation state; navigation aborts pending actions, and late responses cannot update the replacement view. A synchronous request guard prevents duplicate actions.
- Separated action errors from refresh errors so background requests cannot hide a failed invitation response.
- Added regression tests for stale poll completion during an action, paused polling, recovery after failure, match changes, aborted requests, ignored late responses and unmount cleanup.
- Validation: all 245 tests across 36 files passed; lint, typecheck and production build passed. No player code executed.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency, sandbox isolation/resource enforcement and deployment smoke checks remain pending.

### 2026-11-06 - Arena polling recovery and cleanup
- Reviewed the unchecked problems 1-20 and 21-60 items. Both remain blocked on isolated Judge0 validation; no .env is configured. Added and completed one independent arena reliability item.
- Returning to a visible arena tab immediately refreshes authoritative state rather than waiting for the next scheduled poll. Repeated visibility events share an in-flight request, and refreshes replace the scheduled timer so only one polling chain remains. Successful refreshes clear stale-update feedback.
- Completed and cancelled arenas stop polling and clock intervals and remove the visibility listener. Arenas opened in either terminal state do not poll. Unmount still aborts outstanding requests and removes timers/listeners.
- Added regression tests for both terminal states, initial and polled completion/cancellation, hidden/visible transitions, error recovery, overlapping events, one polling chain and unmount cleanup.
- Validation: all 242 tests across 36 files passed; lint, typecheck and production build passed. No player code executed.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency, sandbox isolation/resource enforcement and deployment smoke checks remain pending.

### 2026-11-06 - Phone arena layout and keyboard scrolling
- Reviewed the unchecked problems 1-20 and 21-60 items. Both remain blocked on isolated Judge0 validation; only .env.example is available. Added and completed one independent arena usability item.
- On narrow phones the clock occupies its own row above the players, long names wrap within their columns, and submission controls span the editor panel. Problem titles wrap and long signatures/examples scroll locally in named, keyboard-focusable regions.
- Added Chromium regression coverage for actual arena markup in pending, active, completed and cancelled states at 320/375/768/1280px, with long names, titles, constraints and code. Checks cover page overflow, keyboard scrolling, clock placement and phone button widths. The dynamically loaded Monaco editor is outside this static-markup test; live editor smoke checks remain pending.
- Validation: all 237 tests across 36 files passed; lint, typecheck and production build passed. No player code executed.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Existing live database concurrency and sandbox isolation/resource smoke checks remain pending.

### 2026-11-06 - Results feedback and optional replay
- Reviewed the unchecked catalog items. Both remain blocked on isolated Judge0 validation; only .env.example is present. Added and completed one independent player-facing improvement: authoritative results feedback with optional replay.
- Results now show an animated victory, defeat or draw cue, share the existing persistent sound toggle and offer a Replay result button. Opening the page shows visual feedback without unlocking audio or autoplaying sound. Replay unlocks through a user click and plays the outcome when sound is enabled; muted replay still animates. Added an original draw tone sequence and label. Existing reduced-motion, hidden-tab and unavailable-device safeguards apply.
- Added outcome-specific regression tests for visual feedback, stable rerenders, explicit audio unlocking, correct cue selection and muted replay. The shared audio tests also exercise draw note scheduling and cleanup.
- Validation: all 236 tests across 36 files passed; lint, typecheck and production build passed. No player code executed.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database concurrency and sandbox isolation/resource smoke checks remain pending.

### 2026-11-06 - Arena verdict feedback
- Reviewed the two unchecked catalog items; isolated Judge0 validation remains blocked because this workspace has only .env.example. Added and completed one independent improvement: animated arena verdict feedback with optional sound.
- Added the latest own submission ID to the participant-only snapshot without exposing code or private problem data. Each newly observed judged submission cues pass when all tests pass and fail otherwise. Stable submission IDs prevent repeated polling from replaying cues while allowing consecutive identical scores to trigger separate feedback. Existing verdicts do not replay on opening the arena; queued/running/error states do not trigger verdicts.
- Added the shared sound toggle to the arena header. Sound stays off by default, restores the existing preference and unlocks on user interaction; visual feedback works while muted. Shared reduced-motion and hidden-tab audio behavior remain in effect.
- Added regression coverage for history suppression, judging/retry states, duplicate polls, identical scores across distinct submissions, all-pass/partial results and muting, plus database coverage for the projected submission ID.
- Validation: all 232 tests across 36 files passed; lint, typecheck and production build passed. No player code executed.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Live database, concurrent-worker and sandbox isolation checks remain pending. Results sound feedback is a future improvement.

### 2026-11-06 - Arena draft recovery
- Reviewed the two remaining unchecked catalog items. Both remain blocked on isolated Judge0 validation; this workspace has no configured .env. Added and completed one independent improvement: protect players from losing arena work on an accidental refresh.
- Arena drafts now recover from sessionStorage, keyed by match and player. Empty drafts recover correctly. Switching matches or players creates a separate editor session. Saved code is removed when authoritative polling reports completion or cancellation; ended matches do not restore drafts.
- Added visible recovery status. Storage read/write failures leave editing and submission usable with honest feedback. Drafts stay in browser tab storage, never shared localStorage; browser session restoration or duplicated tabs may retain copies. Clearing requires observing the ended match in that tab. Server-side judging and submission rules are unchanged.
- Added refresh/remount, empty draft, match/player isolation, completed/cancelled cleanup and unavailable-storage submission tests. Fixed a test mock that returned a submission response to arena polling.
- Validation: all 231 tests across 36 files passed; lint, typecheck and production build passed. No player code executed.
- Next: configure isolated Judge0 and author/validate problems 1-20, then 21-60. Existing live database, concurrent-worker and sandbox smoke checks remain pending.

### 2026-11-06 - Consensual rematch invitations
- Selected and checked off the rematch invitation item. The catalog items remain blocked on isolated Judge0 validation; no unvalidated problems were published.
- Results pages now let either participant send a 60-second invitation. The opponent explicitly accepts or declines; the sender can cancel. Both pages poll authoritative state and expose the accepted arena link. Errors are visible, polling retries and requests time out.
- Added migration 006_rematches.sql and participant-only authenticated endpoints with origin checks, fixed action allowlists, session-derived identity, private no-store responses and generic infrastructure errors. Each completed match permits one invitation; decline, cancellation and expiry are terminal to avoid repeated prompts. New match remains available.
- Acceptance atomically creates one pending reservation and records its ID. Repeated acceptance recovers the same arena. Shared matchmaking reservation logic locks users in stable order, checks unfinished matches, selects difficulty from current ratings and rotates published problems. Expiry is checked again after acquiring user locks. Normal readiness and reservation expiry apply to the new arena.
- Added embedded Postgres coverage for consent, outsider access, duplicate sends/acceptance, decline/cancel, expiry, unpublished problems, busy players and rollback; added endpoint origin/auth/action/privacy/error tests and UI acceptance/link/error tests. Updated the obsolete disabled-rematch assertion without removing tests.
- Validation: all 226 tests across 36 files passed; lint, typecheck and production build passed. No player code executed.
- Limits: apply migration 006 before use. Real Postgres concurrent queue/rematch behavior and live browser/database deployment still require smoke checks. Existing isolated sandbox and unpublished catalog blockers remain.
- Next: configure isolated Judge0 and author/validate problems 1-20; smoke-test deployment, concurrent reservation/settlement and sandbox resource enforcement.

### 2026-11-06 - Match lifecycle orchestration
- Selected and checked off the match lifecycle item. Added migration 005_match_lifecycle.sql and a dedicated lifecycle worker with independent reservation/settlement and sandbox job loops, so long judging jobs do not delay expiry.
- Both participants must explicitly ready within 60 seconds. Activation is idempotent and starts Easy/Medium/Hard clocks of 5/15/30 minutes. Expired reservations cancel without ratings. Participant-only same-origin POST actions admit Python code using database time after acquiring the match lock, reject deadline/size violations and enforce one outstanding judgment, five-second pacing and 20 submissions per player.
- Added durable job leases, attempt fencing, crash recovery and delayed infrastructure retries through the existing isolated Judge0 adapter. Persisted median benchmark CPU and three samples use trusted server admission times. No player code ran on the host or during this work.
- Deadline settlement waits for accepted judgments and chooses each player's best score. No submission uses zero passed tests, benchmark CPU limits and deadline time, with null submission time in results. Two no-shows draw. Match completion, both final snapshots, both rating states and history commit atomically under row locks; repeated settlement cannot duplicate ratings.
- Connected arena Ready/Submit controls, safe error feedback and polled own judging/test status. Documented deployment and recovery policies in README.md.
- Added embedded Postgres tests for access, readiness/expiry, difficulty timers, late admission, limits, best-score selection, median CPU, no-shows, infrastructure retry, lease recovery, stale-worker fencing, adapter validation, rollback and repeated completion. Added route origin/auth/body/privacy coverage and UI draft submission/readiness/verdict/error coverage.
- Validation: all 221 tests across 33 files passed; lint, typecheck and production build passed. Fixed a UI polling mock exposed by the full suite. No tests removed.
- Limits: apply the migration and run the worker with an isolated sandbox. Jobs retry after infrastructure errors; forced shutdown jobs become reclaimable after the one-hour lease. Extremely long runs can execute redundantly after lease expiry, with fenced writes. Embedded Postgres tests do not establish real multi-process Postgres lock behavior; live concurrent-worker and Judge0 isolation/resource smoke checks remain pending. Published problem catalog and existing infrastructure blockers remain.
- Next: isolated Judge0 and validated problems 1?20, deployment smoke checks, then consensual rematch invitations.

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




