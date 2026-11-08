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
- [x] Associate the plain Python code field with its visible read-only notice, preserving existing keyboard guidance, independent-editor descriptions, focus and selection through repeated recovery with regression coverage
- [x] Preserve plain-editor indentation-control keyboard focus when a solution becomes read-only, with styled unavailable states, isolated visible explanations and draft/selection/recovery regression coverage
- [x] Explain advanced-editor read-only state with styled copy/export guidance and remove misleading indentation instructions, preserving code, preferences and focus across state changes with regression coverage
- [x] Explain editor text-size limits with styled visible guidance and isolated accessible descriptions, preserving focus, code and independent editors with boundary/recovery regression coverage
- [x] Make editor line wrapping visibly show On/Off with an accent selected state, preserving accessible toggle names, preferences, code and focus in both editor modes with regression coverage
- [x] Announce repeated arena draft-reading retry failures with amber feedback and accessible recovery descriptions, preserving earlier code, focus and both-editor recovery with regression coverage
- [x] Highlight arena draft storage failures with amber warning headings and associate recovery controls with code-protection guidance, preserving both-editor focus and recovery with regression coverage
- [x] Retry local arena draft saving with Ctrl+S / Command+S in both editors, preserving unread-draft consent, focus and closed-match safety with visible guidance and regression coverage
- [x] Confirm unread saved-draft replacement before retry saving, preserving cancellation, focus and fresh consent in both editors with regression coverage
- [x] Retry reading unread arena drafts before editing without destructive replacement, with accessible recovery guidance, focus preservation and both-editor failure/recovery regression coverage
- [x] Guard leaving or refreshing unread arena drafts before editing, with visible recovery guidance and failed-save, successful-save, match-closure and cleanup regression coverage
- [x] Protect unread arena drafts from automatic replacement after storage read failures, with explicit replacement guidance and retry/editing regression coverage
- [x] Retry failed arena draft saves without edits or submission, with prominent recovery guidance, preserved code and keyboard focus, and storage/closed-match regression coverage
- [x] Explain clipboard completion after edits with amber earlier-draft success guidance and explicit failure context, preserving focus, current-draft retry and stale-notice cleanup in both editor modes with regression coverage
- [x] Refresh overdue clipboard recovery guidance when suspended tabs resume or regain focus, preserving fresh-request deadlines, focus and timer/listener cleanup in both editor modes with regression coverage
- [x] Explain stalled clipboard requests after ten seconds with prominent permission and alternative-export guidance, preserving focus, draft safety and timer cleanup in both editors
- [x] Give copy and download failures prominent danger-colored recovery headings while preserving accessible action descriptions, keyboard focus and retry recovery in both editor modes
- [x] Highlight pending solution copies and explain when continued editing makes the captured clipboard draft stale, preserving focus, revision safety and fresh-copy recovery in both editors with regression coverage
- [x] Distinguish destructive starter replacement with a prominent warning heading, danger-colored confirmation and replacement action, preserving safe default focus and accessible consequences in both editors with regression coverage
- [x] Expose starter-reset confirmation expanded state and stable editor-specific ownership to assistive technology, clearing stale relationships after cancellation, draft/starter changes and replacement with regression coverage
- [x] Dismiss pending starter-code resets with Escape anywhere in their owning editor, restoring Reset focus while preserving drafts, independent editors and IME input with regression coverage
- [x] Keep unavailable starter reset keyboard-accessible with styled, editor-specific matching-draft guidance and focus/replacement regression coverage
- [x] Preserve keyboard focus at editor text-size limits and after reset with focusable unavailable controls, consistent disabled styling and no redundant storage writes, covering editable/read-only recovery
- [x] Retry saving editor preferences without changing settings, with styled accessible recovery, preserved code and keyboard focus, and independent-editor regression coverage
- [x] Make editor preference storage failures visually prominent and associate preference controls with isolated saving-retry guidance, preserving code and focus through recovery with regression coverage
- [x] Make advanced-editor fallback guidance visually prominent and associate Retry with stable, isolated code-preservation and preference guidance, covering repeated failure, recovery, keyboard focus and editor switching
- [x] Associate styled clipboard success and retry notices with their Copy actions, preserving focus, stale-feedback cleanup and multiple-editor isolation with regression coverage
- [x] Associate Download actions with styled, isolated save and retry guidance, preserving focus and clearing stale descriptions after draft changes with regression coverage
- [x] Confirm solution download requests with accessible browser-save guidance, clearing stale notices after draft changes and preserving focus, editor switching and failure/retry recovery with regression coverage
- [x] Keep pending Copy actions keyboard-focusable with isolated accessible permission guidance and consistent busy styling, preventing duplicate requests and preserving independent focus through success/failure with regression coverage
- [x] Announce pending solution copies with clipboard-permission and captured-draft guidance and accessible busy state, preserving editing and stale-feedback suppression with success/failure regression coverage
- [x] Associate solution-reset confirmation actions with the visible replacement warning using stable, isolated accessible descriptions, preserving keyboard cancellation and editor preferences with regression coverage
- [x] Let Tab and Shift+Tab navigate out of the advanced Python editor by default, with visible indentation shortcuts and editable/read-only preference regression coverage
- [x] Reject accessor-backed top-level judge request fields without invoking getters, preserving frozen requests, ignored metadata and adapter reuse with regression coverage
- [x] Refresh loading and recovery connection guidance on window focus after missed browser connection events, preserving stable announcements, recovery focus and overdue loading feedback with lifecycle regression coverage
- [x] Reject accessor-backed judge suite indices and test fields without invoking getters, preserving frozen suites, ignored metadata and adapter reuse with regression coverage
- [x] Reject accessor-backed JSON arguments and expected answers before invoking getters or network access, preserving frozen data, ignored metadata and adapter reuse with regression coverage
- [x] Traverse judge suites and nested JSON arrays by index so custom iterators and mapping methods cannot bypass validation or alter snapshots, rejecting sparse arrays with no-network and adapter-reuse regression coverage
- [x] Snapshot only validated judge suite fields and JSON values so unrelated metadata cannot break cloning or override serialized arguments, with nested-array and literal-key regression coverage
- [x] Validate optional judge credentials and execution diagnostics at adapter creation before network access, with credential-safe errors and valid-configuration regression coverage
- [x] Compare numeric signed zero consistently across expected answers and sandbox JSON output, preserving nested correctness, caller-owned suites and failed-test CPU penalties with regression coverage
- [x] Distinguish offline recovery notices with amber borders and headings and restored connections with green headings across unavailable, route-error and standalone root-error screens, preserving stable announcements and focus with component and phone/desktop browser regression coverage
- [x] Reject malformed top-level judge requests with consistent validation before network access, preserving adapter reuse with regression coverage
- [x] Bound expanded judge JSON values across the request before cloning or network access, rejecting exponentially shared graphs while preserving supported large inputs and adapter reuse
- [x] Reject cyclic and excessively nested judge JSON data before cloning or network access, preserving shared acyclic values and supported nesting with boundary and retry regression coverage
- [x] Reject malformed and sparse judge suite entries with consistent request validation before benchmark lookup or network access, preserving adapter reuse with regression coverage
- [x] Reject non-boolean judge benchmark flags and non-string function names before network access, preserving explicit benchmark selection with regression coverage
- [x] Snapshot validated judge request suites and submission timestamps before network access so asynchronous caller mutations cannot change answers, benchmark selection, test totals or tiebreakers, with nested-mutation regression coverage
- [x] Snapshot validated sandbox configuration so caller mutations cannot change credentials, resource limits, diagnostics or scoring penalties during execution, with before/during-execution and adapter-reuse regression coverage
- [x] Distinguish offline and delayed page loading with a stationary amber offline mark and amber long-wait spinner, preserving stable announcements, recovery focus and reduced-motion support with component and phone/desktop browser regression coverage
- [x] Reject malformed sandbox output encodings before answer comparison, preserving valid Unicode and full failed-test CPU penalties with regression coverage
- [x] Reject sandbox request and polling timer overflow before network access, preserving supported boundary settings with regression coverage
- [x] Reject overflowing sandbox CPU conversions, configured penalties and benchmark totals before scoring, with fail-closed regression coverage
- [x] Reject sandbox submission and polling redirects to prevent forwarding credentials and source, with fail-closed real HTTP regression coverage
- [x] Prevent malformed sandbox URLs from exposing configured credentials in parser errors, preserving fail-closed configuration validation with secret-retention and no-network regression coverage
- [x] Report sandbox-unavailable catalog validation failures with actionable credential-safe recovery guidance, nonzero exit status and database cleanup, with validate/publish regression coverage
- [x] Offer overdue loading recovery immediately when suspended pages resume, checking the elapsed deadline independently of delayed timers while preserving stable guidance and keyboard focus with boundary and reopening regression coverage
- [x] Refresh loading-screen connectivity when suspended pages resume, preserving styled guidance, recovery controls and keyboard focus with missed-event and cleanup regression coverage
- [x] Refresh error and unavailable-page browser connection guidance when suspended pages resume, preserving manual recovery, stable announcements and keyboard focus with missed-event and cleanup regression coverage
- [x] Explain browser outages and reconnection on unavailable pages with styled polite guidance, preserving access uncertainty, recovery links and keyboard focus with lifecycle regression coverage
- [x] Explain browser outages and reconnection on route and root error screens with styled polite guidance, preserving manual recovery, keyboard focus and listener cleanup with regression coverage
- [x] Announce browser reconnection during page loading with a styled, stable polite notice, preserving server-availability uncertainty, recovery controls and keyboard focus with outage and reopening regression coverage
- [x] Explain existing-match recovery on route and root error screens with prominent live-clock and server-confirmation guidance associated with home links, preserving stable descriptions and focus with regression coverage
- [x] Show immediate browser-offline loading guidance with styled recovery controls, preserving keyboard focus through reconnection and covering connection transitions and listener cleanup
- [x] Add explicit reload recovery after stalled page loading with styled unsaved-change and live-clock guidance, stable accessible descriptions and delay, focus, isolation and reload regression coverage
- [x] Clarify loading-screen existing-match recovery with prominent live-clock and server-confirmation guidance associated with the recovery link, preserving focus and stable descriptions through delayed loading with regression coverage
- [x] Clarify unavailable-page live-clock and existing-match recovery with styled accessible guidance and phone/desktop regression coverage
- [x] Add explicit full-page reload recovery to route and root error screens with styled unsaved-change and live-clock guidance, stable accessible descriptions and independent retry regression coverage
- [x] Associate page retry controls with prominent visible retry and live-clock guidance across route and root error boundaries, preserving stable descriptions and focus with regression coverage
- [x] Explain page loads exceeding fifteen seconds with styled recovery guidance and stable polite feedback, preserving keyboard focus and covering delay boundaries, navigation cleanup and reopening
- [x] Make password privacy guidance expandable with a keyboard-accessible styled disclosure, keeping requirements visible and independent form state covered by regression tests
- [x] Limit account password reveals to 30 seconds with visible guidance, independent timers, preserved credentials and keyboard focus, fresh reveal recovery and cleanup regression coverage
- [x] Explain specific username correction reasons across account and friend forms, preserving server validation, independent state, keyboard focus and reset/replacement recovery with regression coverage
- [x] Conceal revealed account passwords when focus leaves their owning form, preserving within-form navigation, credentials, validation and explicit reveal recovery with regression coverage
- [x] Conceal revealed account passwords with Escape from anywhere in their owning form, preserving independent forms, keyboard focus, values and validation with regression coverage
- [x] Show remaining password minimum-length requirements alongside the responsive byte budget, preserving independent forms, replacement values, reveal and reset with regression coverage
- [x] Show responsive username character budgets across account and friend forms, preserving validation, independent state and reset/replacement recovery with regression coverage
- [x] Detect Caps Lock when players click into either password field before typing, preserving independent warnings, values and validation with regression coverage
- [x] Add a styled, politely announced password visibility notice and describe reveal controls with concealment guidance, preserving independent forms and automatic concealment with regression coverage
- [x] Distinguish invalid username and password fields with danger-colored borders and explicit validation messages, preserving correction recovery and keyboard focus with phone/desktop browser regression coverage
- [x] Explain remaining password UTF-8 capacity and exact overflow with responsive danger-colored cues, preserving validation, reveal and reset recovery with component and browser regression coverage
- [x] Conceal revealed account passwords when the browser window loses focus, preserving values, validation and explicit reveal recovery with regression coverage
- [x] Explain leaderboard shared ranks, full-precision ordering and tied-player cutoff with a compact styled disclosure and public/friends regression coverage
- [x] Show the weekly leaderboard UTC date window with clear reset guidance and responsive styling, covering Monday rollover, year boundaries, leap days and both scopes
- [x] Distinguish weekly leaderboard rounded gains, losses and unchanged values with visible text and color accents, preserving rounding and public/friends snapshot transitions with regression coverage
- [x] Format matchmaking elapsed waits with compact minute/hour units and full screen-reader text, preserving server authority and silent updates with boundary and lifecycle regression coverage
- [x] Restore Play keyboard focus after failed matchmaking reservations, preserving independent navigation and successful retry with timeout, server-error, disconnect and malformed-confirmation regression coverage
- [x] Recover stalled matchmaking searches after missing queue updates, preserving keyboard navigation, reservation deadlines and ticket recovery with regression coverage
- [x] Reject impossible matchmaking queue statistics before display, preserving keyboard recovery and successful retry with regression coverage
- [x] Preserve the keyboard handoff from focused search cancellation through reservation to Open arena, respecting independent navigation and clearing focus intent on retry with regression coverage
- [x] Reject unknown matchmaking response types and malformed server error guidance before UI updates, restoring keyboard retry with regression coverage
- [x] Reject malformed matchmaking confirmations before match feedback and arena navigation, preserving keyboard recovery and successful retry with regression coverage
- [x] Restore Play keyboard focus when search failures remove a focused Cancel search control, preserving independent navigation, stale-connection safety and successful retry with regression coverage
- [x] Recover from browser WebSocket construction failures with actionable matchmaking retry guidance, cleared busy state and successful-retry keyboard regression coverage
- [x] Associate matchmaking actions with stable visible guidance and expose pending confirmation busy states, with lifecycle and multiple-panel accessibility regression coverage
- [x] Restore Play keyboard focus after explicit search cancellation confirmation or failure, preserving independent navigation and match-reservation races with regression coverage
- [x] Move keyboard focus from a focused matchmaking search control to the confirmed Open arena link, preserving independent navigation and stale-connection safety with regression coverage
- [x] Repair matchmaking rating-range notation and verify readable copy across connection, search, cancellation and reservation states with lifecycle regression coverage
- [x] Announce final-ten-second rematch urgency through stable polite invitation guidance without per-second chatter, preserving action and lifecycle transitions with participant-symmetric regression coverage
- [x] Restore keyboard focus to invitation guidance after sending a rematch invitation, preserving independent navigation and background updates with direct, polled and failure regression coverage
- [x] Restore keyboard focus to updated invitation guidance after successful manual rematch recovery, preserving independent navigation and background refresh focus with failure and lifecycle regression coverage
- [x] Restore keyboard focus to the new-opponent link after explicit rematch decline or cancellation, preserving independent focus and background outcomes with direct and polled confirmation regression coverage
- [x] Show explicit refreshing labels and accessible busy states on rematch recovery buttons during manual and automatic retries, with failure-reset and recovery regression coverage
- [x] Show action-specific rematch button labels and accessible busy states while awaiting confirmation, retiring feedback at invitation expiry and outcomes with retry and participant-symmetric regression coverage
- [x] Highlight the final ten rematch invitation seconds with an amber countdown accent and explicit text cue, retiring urgency during actions, extended windows, expiry and terminal outcomes with participant-symmetric regression coverage
- [x] Make incoming and outgoing rematch invitations visually distinct with responsive direction cues that retire during actions, deadline expiry and terminal outcomes, with participant-symmetric lifecycle regression coverage
- [x] Replace indefinite initial rematch checking feedback after lookup failures with explicit unavailable status and automatic-retry guidance, preserving stable announcements and recovery action descriptions with regression coverage
- [x] Associate rematch actions and recovery links with stable visible invitation guidance, with lifecycle and multiple-panel accessibility regression coverage
- [x] Restore keyboard focus to the rematch arena link after explicit acceptance, including polled confirmation, while preserving independent focus during background updates with regression coverage
- [x] Retire failed rematch action feedback when authoritative polling discovers a different invitation, preserving same-invitation retry errors with participant-symmetric regression coverage
- [x] Announce restored rematch invitation updates with polite visible snapshot guidance, recurring-outage reset and participant-symmetric automatic/manual retry and terminal-outcome regression coverage
- [x] Retire obsolete rematch action errors at invitation deadlines and authoritative outcomes, preserving active-window retry feedback with participant-symmetric and delayed-failure regression coverage
- [x] Preserve one stable polite rematch announcement region through authoritative acceptance, decline, cancellation and expiry, with reopening, polling and delayed-action regression coverage
- [x] Retire expired rematch invitation prompts and busy styling with polite server-confirmation guidance, incoming/outgoing reopening and delayed-action regression coverage
- [x] Retire expired arena submission action feedback and busy indicators, preserving server-confirmation and code-export guidance with reopening, delayed-response and terminal polling regression coverage
- [x] Retire expired readiness action prompts and busy indicators, preserving authoritative server confirmation guidance with reopening, delayed-response and terminal polling regression coverage
- [x] Make arena submission-shortcut guidance follow readiness, active play, expiry and terminal states, preserving accessible button descriptions with polling and reopening regression coverage
- [x] Make verified arena best-score guidance follow settlement and terminal states, retiring future-attempt and result-confirmation promises while preserving scores, verdict badges and accessible descriptions with participant-symmetric reopening and polling regression coverage
- [x] Make latest arena attempt feedback follow clock expiry and terminal states, retiring closed-submission correction prompts and stopped-polling promises while preserving verified verdicts with component and arena transition regression coverage
- [x] Make empty and unavailable arena progress guidance follow readiness, running, settlement and terminal phases, removing closed-submission prompts and stopped-polling promises with participant-symmetric reopening and transition regression coverage
- [x] Announce expired arena readiness windows through a stable polite region, preserving pre-expiry readiness feedback and authoritative activation/cancellation guidance with reopening, outage and terminal-state regression coverage
- [x] Announce expired arena clocks through a stable polite settlement region, preserving visible waiting and code-export guidance with expiry, reopening, outage and terminal-state regression coverage
- [x] Retire obsolete arena action feedback after lifecycle changes, including delayed acknowledgements, with phase-specific guidance and polling regression coverage
- [x] Announce authoritative arena cancellation through a stable polite live region, preserving recovery and code-export guidance with reopening, polling and other-state regression coverage
- [x] Announce authoritative arena activation with a responsive start notice, stable polite feedback and reopening, expiry and terminal-state regression coverage
- [x] Announce authoritative arena completion with a prominent responsive results panel, preserved code-export guidance and initial/polling/terminal-state regression coverage
- [x] Announce restored arena live updates after connection failures with visible snapshot feedback and retry, recurring-outage and terminal-state regression coverage
- [x] Announce both players' arena best-score changes through stable polite live regions, with exact verified counts, unavailable-state recovery and participant-symmetric polling regression coverage
- [x] Withhold arena best-score and tiebreak claims for missing or invalid progress, restoring associated guidance after verified polling updates with participant-symmetric regression coverage
- [x] Associate each saved-results progress bar with visible best-submission and tiebreak guidance, preserving unavailable-history safeguards with participant-symmetric recovery tests
- [x] Identify both saved-results progress bars by player in accessible names, preserving exact counts and unavailable-score recovery with participant-symmetric regression coverage
- [x] Announce exact hidden-test counts on both arena progress bars, with participant-symmetric polling, unavailable-score and recovery regression coverage
- [x] Polish arena empty-progress cards with clearer visual hierarchy and responsive spacing, preserving unavailable-state and keyboard accessibility
- [x] Reject impossible calendar dates and normalized midnight timestamps in shared completion-date displays, preserving leap days and offset conversion with corrected-history regression coverage
- [x] Reject ambiguous timezone-free completion dates across dashboard, profile and results, preserving absolute UTC display and covering invalid-history recovery
- [x] Distinguish zero-pass arena latest verdicts and both best-progress cards with failure-colored accents, preserving unavailable states with transition and phone/desktop browser regression coverage
- [x] Distinguish saved zero-pass results from partial success with failure-colored verdict badges and progress accents, participant-symmetric transition tests and phone/desktop browser coverage
- [x] Distinguish incomplete saved rating pairs from wholly unrecorded history, preserving outcome and independent metrics with participant-symmetric recovery regression coverage
- [x] Explain invalid saved benchmark CPU metrics explicitly on results cards, preserving independent valid metrics and covering both participants and corrected-history recovery
- [x] Render saved submission timing independently of missing or invalid test counts, preserving valid timestamps and distinguishing absent history from unavailable metrics with participant-symmetric recovery tests
- [x] Distinguish incomplete saved test-count pairs from unrecorded results, with participant-symmetric unavailable feedback and corrected-history regression coverage
- [x] Add a native results comparison shortcut with focusable heading, phone-friendly styling and component/browser keyboard regression coverage
- [x] Withhold saved-results verdict cues and detailed scoring explanations for invalid submission timestamps, with explicit unavailable guidance and participant-symmetric recovery regression coverage
- [x] Withhold contradictory no-submission explanations and fallback CPU labels for saved positive scores without submission times, with explicit unavailable guidance and participant/recovery regression coverage
- [x] Share safe test-count validation between saved-result explanations and comparison cards, withholding explanations for unsafe counts and covering participant symmetry and corrected-history recovery
- [x] Distinguish corrupt mixed missing/invalid saved rating pairs from unrecorded history, preserving outcome and valid-history recovery with regression coverage
- [x] Make results comparison guidance a compact native disclosure with styled touch controls and component and phone keyboard regression coverage
- [x] Distinguish saved full, partial and zero-pass results with responsive text badges and green/amber progress accents, withholding verdict styling for unavailable scores and covering recovery and phone layouts
- [x] Withhold invalid saved results ratings and tier changes with explicit unavailable guidance and recovery regression coverage
- [x] Withhold invalid saved results timing values with explicit unavailable guidance and recovery regression coverage
- [x] Validate saved results test counts before rendering progress, fallback-score guidance or numeric comparisons, with explicit unavailable feedback and recovery regression coverage
- [x] Distinguish zero-pass latest and best arena scores from partial success with explicit badges, correction guidance and polling regression coverage
- [x] Recover verdict feedback after reopening an arena with an unavailable initial judged score, preserving silent valid history and once-only polling recovery
- [x] Distinguish partial and full arena best scores with responsive text badges and amber/green progress accents, explicit full-pass result guidance and polling-transition regression coverage
- [x] Validate both arena best-progress bars, distinguish missing submissions from unavailable scores, and recover valid zero/full scores after polling with regression coverage
- [x] Withhold arena sound and visual verdict cues for invalid judged scores, share score validation with submission status, and cover corrected-score polling and once-only recovery
- [x] Replace unavailable or invalid judged submission counts with explicit automatic-update guidance, withholding verdict accents until a valid score arrives, with polling-transition regression tests
- [x] Distinguish fully and partially passing arena submissions with text verdict badges, responsive green/amber accents and explicit full-pass tiebreak guidance, with status-transition regression tests
- [x] Add native public example shortcuts with unique focusable heading targets, phone-friendly controls and component/browser keyboard regression coverage
- [x] Make arena judging guidance a compact native disclosure with styled touch controls and component and phone keyboard regression coverage
- [x] Add visible keyboard scrolling guidance to public example code regions with unique accessible descriptions, responsive styling and component and phone browser regression coverage
- [x] Make repeated example-format guidance a compact native disclosure with styled touch controls and keyboard and phone regression coverage
- [x] Make weekly standings scoring guidance a compact native disclosure with styled touch controls and component and phone keyboard regression coverage
- [x] Replace raw empty public example values with a styled accessible notice explaining the function contract and hidden-test correctness, preserving legacy example rendering with regression coverage
- [x] Group dashboard section shortcuts into a named native navigation landmark with consistent spacing, full-width phone controls and component/browser keyboard regression coverage
- [x] Make dashboard scoring guidance a compact native disclosure with styled touch controls and component and phone keyboard regression coverage
- [x] Make the dashboard first-duel guide a compact native disclosure with styled keyboard and touch controls, retaining readiness and timer guidance with component and phone browser regression coverage
- [x] Add a native daily-challenge dashboard shortcut with published-preview safeguards, focusable heading, responsive styling and component and browser keyboard coverage
- [x] Add a styled native dashboard rating-tier guide with shared thresholds, full-precision current-tier highlighting and component and phone keyboard regression coverage
- [x] Add a native dashboard shortcut past introductory content to recent duels, with focusable heading, empty/error safeguards and component and phone keyboard regression coverage
- [x] Add a native profile shortcut past rating details to recent duels, with focusable heading, empty/error safeguards and component and phone keyboard regression coverage
- [x] Add a native leaderboard shortcut past ranking guides to a focusable standings heading, with unavailable/empty-state safeguards and component and phone keyboard regression coverage
- [x] Make profile rating journey and disclosure changes round full-precision deltas consistently with duel results, with fractional-boundary regression coverage and rounding guidance
- [x] Add a native expandable public leaderboard rating-tier guide with shared thresholds, weekly-rank and rounding guidance, responsive styling and component and phone keyboard regression coverage
- [x] Add a native expandable account rating-tier guide with full-precision current-tier highlighting and component and phone keyboard regression coverage
- [x] Add a native signed-in account refresh action with responsive snapshot guidance and component and phone keyboard regression coverage
- [x] Show the signed-in account rating tier with full-precision MMR guidance, responsive styling and component/browser regression coverage
- [x] Add a visible native dashboard refresh action with styled page-load snapshot and UTC-day guidance, failure-state preservation and component and phone keyboard regression coverage
- [x] Add a visible native profile refresh action with styled snapshot guidance, canonical player targeting and component and phone keyboard regression coverage
- [x] Add a visible native standings refresh action with preserved period and friends filters, styled snapshot guidance and component and phone keyboard regression coverage
- [x] Add a branded route-loading screen with polite status feedback, reduced-motion support, live-duel clock guidance, native arena recovery and component and phone keyboard regression coverage
- [x] Add self-contained root-layout failure recovery with independent document styling, full-page recovery links, explicit retry and hydration and phone keyboard regression coverage
- [x] Add a branded unexpected-page error boundary with explicit retry, public recovery links, live-match clock guidance and component and phone keyboard regression coverage
- [x] Add a branded unavailable-page recovery screen with public arena and standings links, responsive styling, native skip navigation and component and phone keyboard regression coverage
- [x] Add a prominent invitation shortcut to Friends section navigation, with native heading focus, username-field Tab recovery and phone keyboard regression coverage
- [x] Add contextual global and weekly friends standings actions beside accepted friends, with ranking guidance and component and phone keyboard regression coverage
- [x] Make empty Friends sections actionable with context-aware invitation/reply links, focusable destinations and phone keyboard regression coverage
- [x] Add a visible native Friends refresh action with honest snapshot guidance and component and phone keyboard regression coverage
- [x] Show current MMR and full-precision rating tiers on Friends player cards, with database, component and phone layout regression coverage
- [x] Name Friends management buttons by player for unambiguous assistive navigation, preserving visible labels and native form submissions with regression coverage
- [x] Explain Friends invitation consent, cancellation, mutual removal and standings eligibility in a styled responsive guide with component and phone browser regression coverage
- [x] Add counted Friends-page jump navigation with waiting-request accents, keyboard-focusable destinations and phone browser regression coverage
- [x] Preserve native visual-line Home/End navigation when plain-editor line wrapping is enabled, with mode-aware keyboard guidance and editable/read-only selection regression tests
- [x] Add trailing-whitespace-aware End and Shift+End navigation to the plain Python editor, preserving selection anchors, read-only copying, modified keys and IME composition with regression tests
- [x] Make plain-editor keyboard guidance a styled native disclosure with editable/read-only descriptions and phone keyboard coverage
- [x] Author the original Relay Basin Storage medium two-pointer draft with Python solutions, seeded cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
- [x] Author the original Relay Channel Chain medium hash-set draft with Python solutions, seeded cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
- [x] Add indentation-aware Home and Shift+Home navigation to the plain Python editor, preserving read-only copying, selection anchors, native modified keys and IME composition with regression tests
- [x] Author the original Relay Target Bursts medium prefix-sum counting draft with Python solutions, seeded cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
- [x] Author the original Relay Unique Span medium sliding-window draft with Python solutions, seeded cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
- [x] Author the original Relay Missing Slot easy hash-set draft with Python solutions, seeded cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
- [x] Normalize plain-editor CRLF and CR line endings to textarea offsets for Enter, Backspace, block indentation, selections and size feedback, with regression tests
- [x] Preserve native plain-editor Backspace inside multiline and backslash-continued Python strings, recovering indent stops outside strings with caret and focus regression tests
- [x] Add indent-stop Backspace to the plain Python editor, preserving selections, tabs, native modified keys, read-only drafts and IME composition with regression tests
- [x] Indent plain-editor multiline Python blocks from their opening header line, preserving continuations, nonheaders, selections and caret placement with regression tests
- [x] Author the original Relay Load Capacity medium binary-search draft with Python solutions, seeded cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
- [x] Recover plain-editor block indentation after earlier unfinished ordinary strings, preserving escaped continuations, triple-quoted strings, bracket guards, selections and caret placement with regression tests
- [x] Recover plain-editor block indentation after mismatched delimiters on earlier completed logical lines, preserving current-header guards, selections and caret placement with regression tests
- [x] Support explicit backslash continuations in plain-editor Enter block headers, preserving string/comment context, selections and caret placement with regression tests
- [x] Preserve earlier-line string and bracket context for plain-editor Enter, preventing indentation inside multiline strings and supporting closed multiline headers with selection and caret regression coverage
- [x] Prevent plain-editor Enter from treating unfinished current-line Python triple-quoted strings as block headers, preserving quoted punctuation, selections and caret placement with regression coverage
- [x] Prevent plain-editor Enter from adding block indentation for colons inside unfinished or mismatched current-line delimiters, preserving quoted/comment punctuation, selections and caret placement with regression coverage
- [x] Restrict plain-editor Enter block indentation to Python block headers, preserving dictionary and slice colons, selections and caret placement with regression coverage
- [x] Make plain-editor Enter ignore Python comment colons while indenting commented block headers, with quoted-marker, selection and caret regression coverage
- [x] Prevent Indent and Outdent mouse activation from blurring active IME composition before the click guard, with browser-default focus simulation, selection preservation and recovery tests
- [x] Preserve active IME selections through plain-editor Select all code actions, with mode-change preservation and composition-end/blur recovery tests
- [x] Protect plain-editor toolbar indentation during IME composition, preserving drafts, backward selections and cursor feedback with composition-end and blur recovery tests
- [x] Show a styled accessible plain-editor draft size summary with total lines, explicit UTF-16 units and empty/trailing-newline guidance, preserving selection and read-only behavior with regression tests
- [x] Show selected line counts in the plain editor cursor feedback, matching block-indentation boundaries and preserving forward/backward selections and read-only copying
- [x] Add a styled Select all code action to the plain editor for manual copying, preserving editable and read-only drafts, updating cursor feedback and retaining native copy and Tab behavior
- [x] Clarify read-only plain solutions with a styled accessible notice and copying guidance, preserving drafts, focus, selections and native keyboard behavior through mode changes
- [x] Add discoverable Ctrl/Cmd bracket indentation shortcuts to the plain Python editor, preserving backward selections, native Tab navigation, read-only drafts and IME composition with regression tests
- [x] Refresh silently autofilled password byte budgets and native validation through Show/Hide controls, with Unicode overflow, correction, empty-value, focus and independent-form tests
- [x] Preserve native plain-editor Enter throughout IME composition when keyboard flags are missing, with selection preservation and composition-end and blur recovery tests
- [x] Preserve native IME confirmation Enter in the plain Python editor when composition flags clear early, with selection and subsequent indentation recovery tests
- [x] Preserve backward plain-editor selections and active cursor position through repeated indentation and outdent recovery, with unchanged-text regression coverage
- [x] Dismiss stale solution download failures permanently after draft changes, preserving code, editor preferences and retry recovery in editable and read-only views
- [x] Add a direct advanced-editor retry after rendering failures, preserving fallback edits, preferences, read-only state and keyboard focus through repeated failures and recovery
- [x] Expire solution clipboard success and failure feedback permanently after draft changes, including edits restored during pending copies, with retry and preservation tests
- [x] Expire solution reset confirmations when the draft, starter code or editability changes, preserve new work and require fresh confirmation even when earlier values return
- [x] Conceal revealed account passwords on form submission and native validation failure, preserving independent forms, credentials and correction feedback with listener cleanup tests
- [x] Refresh username native validation and accessible feedback on focus after silent autofill replacements, preserving independent account and friend forms with correction and empty-field tests
- [x] Refresh password byte budgets and native validation on focus after silent password-manager fills, preserving reveal state and independent forms with recovery tests
- [x] Restrict account action feedback to recognized errors and provide specific recovery guidance while rejecting arbitrary URL messages
- [x] Conceal revealed account passwords with Escape from the input or reveal button, preserve focus and independent validation, and explain the keyboard shortcut
- [x] Conceal revealed account passwords on ordinary and cached page departure, preserve credentials and validation feedback, and cover restoration, repeated events and listener cleanup
- [x] Stop duel audio on ordinary and cached page departure, preserve consent and visual feedback, and require a fresh local gesture after return; cover repeated departure and listener cleanup
- [x] Stop active duel audio when a tab is hidden, preserve sound preference and visual feedback, and require a visible local gesture to resume; cover lifecycle cleanup and repeated hiding
- [x] Synchronize saved duel sound preferences across tabs, immediately dispose audio on remote mute or storage clear, and require local gesture unlock after remote enablement
- [x] Add account Clear form actions with independent native reset recovery for username validation, password visibility, byte budgets and Caps Lock feedback; cover cancelled resets and correction
- [x] Author the original Relay Order Conflicts medium sorting draft with Python solutions, seeded cases, full-size benchmarks and fixture tests; leave sandbox approval and publication pending
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

