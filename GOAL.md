# GOAL: Ranked 1v1 Coding Duel Site

A competitive site where two players get the same coding problem and race to solve it. Winner is decided by code quality and speed. Ratings change after every match (MMR). Think chess.com, but for algorithm problems.

## Problem style (important)
Problems are LeetCode / Codeforces style algorithm and data structure questions. Players write a solution function in Python and it is judged against hidden tests with time limits.
- Typical topics: arrays, strings, hash maps, two pointers, sliding window, stacks, queues, linked lists, trees, graphs (BFS, DFS, shortest path), binary search, sorting, heaps, recursion, backtracking, dynamic programming, greedy, intervals, bit manipulation, math
- Each problem gives a function signature to complete, for example `def two_sum(nums: list[int], target: int) -> list[int]:`
- Each problem states input constraints (for example 1 <= n <= 10^5) so players know what complexity is needed
- Difficulty bands: Easy (rating 800 to 1199), Medium (1200 to 1599), Hard (1600+)
- Easy problems should be solvable in about 5 minutes, Medium in about 15, Hard in about 30. Match timers scale with difficulty.
- Problems should have a clear brute force solution and a better optimal solution, so complexity actually matters for winning.

## Match scoring (winner order)
1. Most hidden tests passed (correctness first)
2. Better runtime on the largest tests (proxy for time complexity). Use CPU time or instruction count, never wall clock. Run each submission 3 times and take the median.
3. Earlier submission time (tiebreaker)

If everything ties, the match is a draw.

## Stack
- Next.js + TypeScript frontend
- Node server with WebSockets for matchmaking and live matches
- Postgres for users, matches, ratings, problems
- Judge0 or Piston for sandboxed code execution (no network, memory and CPU limits)
- Python only for v1

## Rating
- Glicko-2 (or Elo as a first pass), new players start at 800 with placement matches
- Matchmaking within a rating band that widens the longer you wait
- Problem difficulty picked from the average rating of the two players
- Show rating change after each match (+8 / -7 style)

## Look and feel (the vibe)
Similar feel to chess.com and other competitive 1v1 sites. Original branding, do not copy their logos or assets.
- Dark theme by default: charcoal backgrounds (#262421 to #312e2b), one strong green accent for primary actions (#81b64c range), white and light grey text
- Flat, chunky, friendly UI. Big rounded buttons. Big primary "Play" button on the home screen.
- Home: Play button, current rating, streak, recent matches, a daily problem
- Matchmaking: "Finding opponent..." with a pulsing animation and estimated wait
- Match screen: code editor on the left (Monaco), problem statement on the right or in a tab. Top bar shows both players with avatar, username, rating, and a countdown timer. Live opponent progress bar showing tests passed (never their code).
- Sound effects and short animations: match found, test passed, test failed, win, loss
- Post-match screen: big WIN / LOSS / DRAW banner, rating change animation, side by side comparison (tests passed, runtime, submit time), "Rematch" and "New match" buttons
- Profile: rating graph over time, win/loss/draw record, tier badge, match history
- Leaderboard: global top players, filter by friends and weekly
- Rating tiers with badges (for example Bronze, Silver, Gold, Platinum, Diamond, Master)
- Mobile friendly layout for everything except the editor view

## Problems
- Do NOT copy LeetCode or other copyrighted problems. Write original problems or original variants.
- Each problem needs: statement, examples, reference solution, brute force solution, test generator, hidden tests including large inputs that make O(n^2) time out when O(n log n) is intended.
- Validate automatically: reference and brute force must agree on thousands of random small inputs. A deliberately slow solution must fail the large tests.
- Tag each problem with difficulty and topic.
- Start with 20 problems, grow toward 200+ over time.

## Rules for the agent
- Work one task at a time from the backlog below. Pick the most valuable unchecked item.
- Always write or update tests. Tests must pass before finishing.
- Never delete tests to make them pass.
- Never run untrusted code outside the sandbox.
- No real secrets in the repo. Use .env.example.
- Keep PROGRESS.md updated: what was done, what is next, any blockers.
- Do not do big refactors unless a backlog item requires it.
- If blocked, write the blocker in PROGRESS.md and move to the next item.

## Never stop improving
Never decide the project is finished. When the backlog is empty, look for more to improve: bugs, edge cases, visual polish, how the site feels to use, new problems, tests, performance, and new features. Add the new ideas to the backlog and keep going. There is always something to make better, so every run must end with real progress and an updated PROGRESS.md.

## Backlog (check off as done)
- [x] Author the original Relay Parity Streak easy dynamic-programming draft with Python solutions, seeded cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
- [x] Author the original Relay Floor Repair easy greedy draft with Python solutions, seeded cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
- [x] Author the original Relay Prefix Diversity easy hash-set draft with Python solutions, seeded cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
- [x] Author the original Relay Balanced Cuts easy prefix-sum draft with Python solutions, seeded cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
- [x] Author the original Relay Cycle Intervals medium prefix-remainder draft with Python solutions, seeded cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
- [x] Show independent accessible UTF-8 password byte budgets with styled Unicode guidance, overflow recovery tests and phone layout coverage
- [x] Automatically conceal revealed account passwords when the tab becomes hidden, preserving credentials, clearing stale Caps Lock feedback and explaining the behavior
- [x] Show personal MMR changes in recent home duels with historical fallback, rounding guidance and phone browser coverage
- [x] Author the original Beacon Horizon Wait medium monotonic-stack draft with Python solutions, seeded cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
- [x] Clarify home win streaks with styled semantic statistics, singular and zero states, completed-duel reset rules and phone browser coverage
- [x] Show daily challenge study topics as styled semantic tags with safe rendering, missing-data handling and phone layout coverage
- [x] Show public daily challenge examples with styled input/output cards, Python notation guidance, safe rendering and phone keyboard scrolling coverage
- [x] Show daily challenge input constraints in a styled accessible preview panel with preserved multiline formatting, safe text rendering and phone keyboard coverage
- [x] Clarify the arena function contract with styled signature formatting, visible keyboard-scroll guidance and match-state and phone browser coverage
- [x] Make arena constraints prominent with optional input-size and complexity guidance, preserved formatting and phone keyboard coverage
- [x] Author the original Buffered Signal Gain easy greedy draft with Python solutions, seeded cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
- [x] Explain hidden tests versus examples and ordered best-submission scoring in a styled accessible arena guide, with phone browser coverage
- [x] Add visible arena problem/solution jump navigation and keyboard skip access with focusable destinations, phone touch targets and browser coverage
- [x] Explain arena example JSON notation and Python function return requirements with a styled accessible guide and phone browser coverage
- [x] Distinguish saved results with no judged submission from zero-pass attempts, explain fallback CPU scores and cover phone layouts
- [x] Connect saved results to completed problem review with honest code availability guidance, styled navigation and phone keyboard coverage
- [x] Visualize saved results correctness with styled, text-labeled hidden-test pass meters, historical fallback and phone browser coverage
- [x] Explain saved results comparison metrics with styled best-attempt guidance, CPU and submission units, scoring precision and phone browser coverage
- [x] Distinguish results MMR gains, losses and unchanged rounded totals with accessible text, shared theme colors, rounding guidance and phone browser coverage
- [x] Show saved results completion timestamps in the outcome banner with semantic UTC dates, historical fallback and phone browser coverage
- [x] Clarify the bounded profile rating journey with styled 50-duel window guidance, accurate timeline origin and accessible graph description, including phone coverage
- [x] Show precise UTC profile duel completion timestamps with shared date styling, historical fallback and phone browser coverage
- [x] Show recent home duel completion dates with semantic UTC timestamps, historical fallback and phone layout coverage
- [x] Connect home recent duels to personal profile history with honest five-versus-20 preview guidance, a styled action and phone keyboard coverage
- [x] Show signed-in home rating-tier badges with shared full-precision thresholds, rounding guidance, guest/error-state and phone browser coverage
- [x] Show saved post-duel rating tiers and explicit tier transitions on results with full-precision thresholds, historical fallback and phone browser coverage
- [x] Show current rating-tier badges in global and weekly standings using full-precision thresholds, with phone browser and boundary coverage
- [x] Explain weekly standings with a styled semantic guide for net gains, negative scores and current rating versus weekly rank, including phone browser coverage
- [x] Clarify home scoring with best-attempt selection, median-of-three CPU timing and semantic ordered cards, including phone layout coverage
- [x] Explain duel lengths and average-rating difficulty bands before queueing with a styled semantic home guide and phone browser coverage
- [x] Clarify friend action results with styled contextual feedback, recovery guidance and rejection of arbitrary URL messages, including phone coverage
- [x] Make friends discoverable from the signed-in home header with keyboard navigation, phone touch targets and session-state coverage
- [x] Explain profile rating tiers with a styled keyboard-accessible threshold guide, current-tier marker and fractional-boundary and phone browser coverage
- [x] Preserve daily challenge signature formatting with a named keyboard-scrollable code region, visible guidance and phone browser coverage
- [x] Clarify populated leaderboard context with a styled selected-period and player-scope summary, accurate displayed counts and top-100 guidance, including phone browser coverage
- [x] Author the original Relay Cooldown Score easy dynamic-programming draft with Python solutions, seeded cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
- [x] Author the original Delayed Drop Pairs medium draft with Python solutions, seeded cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
- [x] Author the original Channel Budget Windows medium draft with Python solutions, seeded cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
- [x] Author the original Signal Rise Debt medium catalog draft with Python solutions, seeded cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
- [x] Clarify public profile records with completed-duel totals, explained win rates, semantic statistic labels and phone browser coverage
- [x] Author the original Spaced Beacon Pairs easy catalog draft with Python solutions, seeded cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
- [x] Author the original Relay Balance Window catalog draft with Python solutions, seeded generation, edge cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
- [x] Make friend-card profile links visibly interactive with explicit accessible names, phone touch targets and keyboard browser coverage
- [x] Replace stale home activation copy with styled, accessible catalog and reservation-readiness guidance, including phone browser coverage
- [x] Distinguish home recent duel wins, losses and draws with consistent text-labeled outcome badges and phone browser coverage
- [x] Guide empty public profiles with accurate player-specific copy, styled duel and standings actions and phone keyboard coverage
- [x] Make expanded profile rating history readable with dated before/after MMR entries, consistent signed changes and phone keyboard coverage
- [x] Guide empty public leaderboards with styled account and duel actions, accurate entry rules and phone keyboard coverage
- [x] Improve account navigation with a visible-on-focus skip link, direct credential-form jumps, named forms and styled error recovery guidance, including phone keyboard coverage
- [x] Guide signed-out friends visitors with a styled account invitation, consent explanation, public standings action and accessible skip navigation, including phone keyboard coverage
- [x] Make populated leaderboard standings easier to read with consistent MMR changes, visible player links and accessible phone keyboard scroll guidance
- [x] Improve public profile duel history with outcome badges, consistent MMR deltas and accessible horizontal-scroll guidance, including phone keyboard coverage
- [x] Improve results navigation with a visible-on-focus skip link, predictable keyboard focus and styled player profile touch targets, including phone browser coverage
- [x] Make daily challenge previews readable with an accessible statement disclosure, preserved formatting and honest practice availability, including phone keyboard coverage
- [x] Guide empty and signed-out friends standings with contextual copy, styled next actions and phone keyboard coverage
- [x] Make profile rating journeys readable with visible MMR scale, timeline and net change, clear summary text and phone coverage
- [x] Link home recent duels to saved results and opponent profiles with accessible names, visible link styling and phone keyboard coverage
- [x] Guide friend invitations with shared accessible username validation, correction recovery and phone-friendly input settings
- [x] Improve password entry with styled accessible Caps Lock guidance and required-field correction recovery
- [x] Explain username rules before submission with styled accessible inline validation, shared server rules and correction recovery
- [x] Recover unavailable arena page reads with a styled accessible fresh-read retry that preserves the requested match and rechecks authentication, with privacy, recovery and phone keyboard coverage
- [x] Recover unavailable account reads with a styled fresh-read retry, suppress credential forms while session state is unknown, and cover recovery and phone keyboard access
- [x] Recover unavailable match results with a styled accessible fresh-read retry that preserves the match and rechecks authentication, with privacy, recovery and phone keyboard coverage
- [x] Recover unavailable home dashboard reads with a styled accessible fresh-read retry, suppress misleading empty stats and queue controls, and cover recovery and phone keyboard access
- [x] Recover unavailable friends reads with a styled accessible fresh-read retry and arena navigation, with privacy, recovery and phone keyboard coverage
- [x] Recover unavailable player profiles with a styled accessible retry that preserves the requested player, with recovery and phone keyboard coverage
- [x] Recover unavailable leaderboard reads with a styled accessible retry that preserves period and friends filters, with phone and keyboard coverage
- [x] Validate account passwords against the server's UTF-8 byte limit before submission, with styled accessible inline feedback and correction recovery
- [x] Present matchmaking wait and rating range as styled metrics without repeating screen-reader announcements on every server tick
- [x] Show a server-based rematch invitation countdown with styled deadline feedback and disable elapsed invitation responses while awaiting authoritative confirmation
- [x] Refresh rematch invitations immediately on tab return without overlapping reads or actions, and stop after terminal outcomes
- [x] Recover failed rematch reads with a styled, accessible immediate retry, refresh feedback and duplicate-request protection
- [x] Stop rematch polling after authoritative terminal states and provide styled, accessible outcomes with clear next actions
- [x] Recover matchmaking from missing reservation confirmation with a bounded deadline and explicit reserving/cancelling feedback
- [x] Replace the signed-in account dead end with a styled matchmaking action, current rating and profile, friends and leaderboard navigation
- [x] Show a styled, accessible latest-submission panel distinguishing queued, judging, sandbox retry and judged states without exposing partial counts as a verdict
- [x] Make starter-code reset confirmation keyboard-accessible with safe initial focus, Escape cancellation and predictable focus recovery
- [x] Highlight the arena's final minute with accessible submission guidance that follows the authoritative clock and clears at expiry
- [x] Show a styled, accessible plain-text editor cursor line, column and selection count, including read-only code and indentation edits
- [x] Show your authoritative best judged arena progress separately from the latest attempt and current edits
- [x] Project scaffold (Next.js, TS, lint, test setup, Postgres schema)
- [x] Design system: colors, buttons, typography, dark theme
- [x] Judge service: run code in the sandbox against tests, return pass count and CPU time
- [x] Scoring function with unit tests for all tiebreak cases
- [x] Rating system (Glicko-2) with unit tests
- [x] Auth (simple username and password or OAuth)
- [x] Matchmaking queue with WebSockets and rating bands
- [x] Match screen: editor, timers, opponent progress bar
- [x] Match lifecycle: activate/expire reservations, sandbox submissions, finalize scores and persist ratings exactly once
- [x] Post-match results screen with rating change animation
- [x] Home page with Play button
- [x] Profile page with rating graph
- [x] Leaderboard
- [x] Problem pipeline: generate, validate, publish
- [ ] Problems 1 to 20 passing validation
- [x] Sound effects and animations
- [x] Anti-cheat basics: rate limits, disable paste in editor optionally, problem rotation
- [ ] Problems 21 to 60
- [x] Mobile layout polish
- [x] Friend relationships and friends-only leaderboard filter





- [x] Consensual rematch invitations with opponent acceptance and expiry
- [x] Recover tab-scoped arena drafts after refresh, isolate matches and players, and handle unavailable storage

- [x] Connect authoritative arena verdicts to animated feedback and optional sound, once per submission
- [x] Add authoritative results feedback for wins, losses and draws with optional sound and explicit replay

- [x] Polish the phone arena scoreboard and submission controls; make problem code blocks keyboard-scrollable with browser regression coverage
- [x] Refresh arena state immediately on tab return, prevent overlapping polls and stop polling ended matches
- [x] Protect rematch actions from stale polls, isolate match views and abort actions on navigation

- [x] Recover matchmaking from missing join/cancel acknowledgements and clean up connection timers
- [x] Guard arena Ready/Submit against duplicate requests and abort pending actions on navigation
- [x] Preserve arena code with a switchable plain-text editor and automatic fallback when Monaco fails

- [x] Warn before browser reload or tab close when an unfinished arena contains edited code; clear warnings after match end
- [x] Download the current Python solution from either editor, including completed matches, with failure feedback
- [x] Reset arena solutions to the full starter code with explicit confirmation, draft persistence and completed-match protection
- [x] Add Python newline indentation to the plain-text editor with caret preservation, accessible keyboard guidance and native Tab navigation

- [x] Present arena examples as numbered input/output and explanation cards with accessible scrolling and phone layout coverage
- [x] Add accessible plain-text Python block Indent/Outdent controls with selection preservation and native Tab navigation

- [x] Add accessible, bounded solution text size controls shared by advanced and plain-text editors, including fallback and completed matches

- [x] Add an accessible line-wrap toggle shared by advanced and plain-text solution editors, including fallback and completed matches

- [x] Copy the current solution from either editor and completed matches with accessible feedback, retry and duplicate-request protection

- [x] Add immediate retry for stale arena updates with accessible connection feedback, duplicate-request protection and preserved drafts

- [x] Explain the deciding scoring rule on results pages with an accessible summary and honest historical-data fallback

- [x] Remember solution editor choice, text size and line wrapping across visits, with validated preferences and graceful storage failure feedback

- [x] Show both participants' reservation readiness with accessible status badges and prevent repeated Ready actions after server confirmation
- [x] Explain cancelled reservations with an accessible recovery panel, rating reassurance and a direct return to matchmaking while retaining visible code for export
- [x] Explain expired arena clocks with accessible pending-results guidance, preserved code export and authoritative completion recovery
- [x] Distinguish current code from the last acknowledged submission, including in-flight edits, failed requests and deadline expiry

- [x] Show a server-based reservation readiness countdown, disable expired Ready actions and await authoritative activation or cancellation

- [x] Keep opponent progress on the best judged test count after weaker attempts, with accessible scoring guidance

- [x] Show accessible submission size guidance and block blank or oversized arena submissions using shared server validation, preserving drafts and export

- [x] Submit from either solution editor with Ctrl+Enter or Command+Enter, with accessible guidance and admission safeguards

- [x] Show accessible in-flight Ready and Submit feedback while preserving editable drafts and distinguishing acknowledgement from judging

- [x] Add accessible, independent password visibility controls to sign-in and sign-up with preserved input and phone-friendly styling

- [x] Restore working friend action submissions and organize incoming requests, friends and sent requests into accessible counted sections with phone layout coverage

- [x] Show styled, accessible rematch action feedback until server confirmation, with retry recovery and duplicate-action protection

