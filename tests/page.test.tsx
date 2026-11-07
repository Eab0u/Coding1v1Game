import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ current: vi.fn(), load: vi.fn() }));
vi.mock("../src/lib/auth-server", () => ({ auth: { current: mocks.current }, database: () => ({}) }));
vi.mock("../src/lib/home", () => ({ loadHome: mocks.load }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
import Home from "../src/app/page";
beforeEach(() => { mocks.current.mockResolvedValue(null); mocks.load.mockResolvedValue({ daily: null, recent: [], streak: 0 }); });
it.each([false, true])("offers a native dashboard refresh with snapshot guidance signedIn=%s", async signedIn => {
  mocks.current.mockResolvedValue(signedIn ? { id: "one", username: "Ada", rating: 800 } : null);
  const view = render(await Home());
  const refresh = screen.getByRole("link", { name: "Refresh dashboard" });
  expect(refresh).toHaveAttribute("href", "/");
  expect(refresh).toHaveAccessibleDescription(/reflect when this page loaded/);
  expect(refresh).toHaveAccessibleDescription(/completed duel or a new UTC day/);
  mocks.load.mockResolvedValue({ daily: null, recent: [], streak: 4 });
  view.rerender(await Home());
  expect(mocks.load).toHaveBeenCalledTimes(2);
  if (signedIn) expect(screen.getByText("4 consecutive wins")).toBeVisible();
});
it("keeps the recovery action instead of snapshot refresh when loading fails", async () => {
  mocks.load.mockRejectedValue(new Error("private"));
  render(await Home());
  expect(screen.queryByRole("link", { name: "Refresh dashboard" })).not.toBeInTheDocument();
  expect(screen.queryByText("Your dashboard at a glance")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Retry dashboard" })).toHaveAttribute("href", "/");
});
it("offers guests a sign-in path and truthful empty states", async () => {
  render(await Home());
  expect(screen.getByRole("link", { name: "Sign in to play" })).toHaveAttribute("href", "/account");
  expect(screen.getByText(/validated catalog/)).toBeVisible();
  expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
  expect(screen.queryByRole("link", { name: "Friends" })).not.toBeInTheDocument();
});
it("shows real account stats, daily challenge and completed results", async () => {
  mocks.current.mockResolvedValue({ id: "one", username: "Ada", rating: 912.3 });
  mocks.load.mockResolvedValue({ streak: 3, daily: { title: "Signal", statement: "Find a signal", difficulty: "easy", function_signature: "def signal(a):" }, recent: [{ id: "m", title: "Pairs", winner_id: "one", opponent: "Bob" }] });
  render(await Home());
  expect(screen.getByText("3 consecutive wins")).toBeVisible();
  expect(screen.getByRole("link", { name: "Friends" })).toHaveAttribute("href", "/friends");
  expect(screen.getByText("WIN")).toBeVisible();
  expect(screen.getByRole("link", { name: "View results for Pairs against Bob" })).toHaveAttribute("href", "/match/m/results");
  expect(screen.getByRole("link", { name: "Bob" })).toHaveAttribute("href", "/profile/Bob");
  expect(screen.getByText("Signal")).toBeVisible();
  expect(screen.getByRole("button", { name: "Play a duel" })).toBeEnabled();
});
it("links each recent outcome to its own results and safely encodes destinations", async () => {
  mocks.current.mockResolvedValue({ id: "one", username: "Ada", rating: 800 });
  mocks.load.mockResolvedValue({ daily: null, streak: 0, recent: [
    { id: "a/b", title: "Pairs", winner_id: "two", opponent: "B ob" },
    { id: "draw", title: "Signals", winner_id: null, opponent: "Carol" },
  ] });
  render(await Home());
  expect(screen.getByText("LOSS")).toBeVisible();
  expect(screen.getByText("DRAW")).toBeVisible();
  expect(screen.getByRole("link", { name: "View results for Pairs against B ob" })).toHaveAttribute("href", "/match/a%2Fb/results");
  expect(screen.getByRole("link", { name: "B ob" })).toHaveAttribute("href", "/profile/B%20ob");
  expect(screen.getByRole("link", { name: "View results for Signals against Carol" })).toHaveAttribute("href", "/match/draw/results");
});
it("contains database errors without exposing secrets", async () => {
  mocks.current.mockRejectedValue(new Error("secret"));
  render(await Home());
  expect(screen.getByRole("alert")).toHaveTextContent("dashboard unavailable");
  expect(screen.queryByText("secret")).not.toBeInTheDocument();
  expect(mocks.load).not.toHaveBeenCalled();
  expect(screen.queryByRole("link", { name: "Friends" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Retry dashboard" })).toHaveAttribute("href", "/");
  expect(screen.queryByRole("link", { name: "Sign in to play" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Player dashboard" })).not.toBeInTheDocument();
});
it("hides invented empty stats after a dashboard failure and recovers on a fresh read", async () => {
  mocks.current.mockResolvedValue({ id: "one", username: "Ada", rating: 912.3 });
  mocks.load.mockRejectedValueOnce(new Error("private database details"));
  const view = render(await Home());
  expect(screen.getByRole("alert")).toHaveTextContent("Player dashboard unavailable");
  expect(screen.getByRole("link", { name: "Friends" })).toHaveAttribute("href", "/friends");
  expect(screen.queryByText(/0 consecutive wins/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Your first duel/)).not.toBeInTheDocument();
  expect(screen.queryByText(/fresh challenge is on its way/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Play a duel" })).not.toBeInTheDocument();
  expect(screen.queryByText(/private database/)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View leaderboard" })).toHaveAttribute("href", "/leaderboard");
  view.rerender(await Home());
  expect(mocks.current).toHaveBeenCalledTimes(2);
  expect(mocks.load).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Play a duel" })).toBeEnabled();
  expect(screen.getByText("0 consecutive wins")).toBeVisible();
});

it("presents daily problems as expandable previews with intact plain text", async () => {
  const statement = "Find the signal.\n\nConstraints:\n  1 <= n <= 100000\n<script>private()</script>";
  mocks.load.mockResolvedValue({ daily: { title: "Signal", difficulty: "easy", statement, function_signature: "def signal(values):\n    pass" }, recent: [], streak: 0 });
  const { container } = render(await Home());
  const disclosure = container.querySelector(".daily-statement")!;
  expect(disclosure).not.toHaveAttribute("open");
  expect(disclosure.querySelector("summary")).toHaveTextContent("Read challenge statement");
  expect(disclosure.querySelector("div")?.textContent).toBe(statement);
  expect(disclosure.querySelector("script")).toBeNull();
  expect(container.querySelector(".daily-signature code")?.textContent).toBe("def signal(values):\n    pass");
  expect(screen.getByText(/Practice submissions are not available yet/)).toBeVisible();
});

it.each([
  ["one", "WIN", "win"], ["two", "LOSS", "loss"], [null, "DRAW", "draw"],
])("labels and styles home outcome %s consistently with profile history", async (winner, label, tone) => {
  mocks.current.mockResolvedValue({ id: "one", username: "Ada", rating: 800 });
  mocks.load.mockResolvedValue({ daily: null, streak: 0, recent: [
    { id: "result", title: "Signals", winner_id: winner, opponent: "Bob" },
  ] });
  render(await Home());
  expect(screen.getByText(label)).toHaveClass("history-result", `history-result--${tone}`);
  expect(screen.getByRole("link", { name: "View results for Signals against Bob" })).toHaveAttribute("href", "/match/result/results");
});

it.each([false, true])("explains catalog eligibility and reservation readiness for signedIn=%s", async signedIn => {
  mocks.current.mockResolvedValue(signedIn ? { id: "one", username: "Ada", rating: 800 } : null);
  render(await Home());
  const guide = screen.getByRole("complementary", { name: "Before your first duel" });
  expect(guide).toHaveTextContent("published, validated problem in your rating band");
  expect(guide).toHaveTextContent("60 seconds to click Ready");
  expect(guide).toHaveTextContent("clock starts when both are ready");
  expect(guide).toHaveTextContent("expired reservation does not change ratings");
  expect(guide).toHaveTextContent("Difficulty follows the two players' average rating");
  const lengths = guide.querySelector("dl")!;
  expect(lengths).toHaveAccessibleName("Duel lengths by difficulty");
  expect(lengths).toHaveAccessibleDescription(/Allow time for the full duel/);
  expect(Array.from(lengths.querySelectorAll("dt"), el => el.textContent)).toEqual(["Easy", "Medium", "Hard"]);
  expect(Array.from(lengths.querySelectorAll("dd"), el => el.textContent)).toEqual([
    "5 minutesBelow 1200 MMR", "15 minutes1200 to below 1600 MMR", "30 minutes1600+ MMR",
  ]);
  expect(screen.queryByText(/match activation are still in development/)).not.toBeInTheDocument();
  if (signedIn) expect(screen.getByRole("link", { name: "Account: Ada" })).toHaveAttribute("href", "/account");
});

it("names the daily signature scroll region and associates keyboard guidance", async () => {
  const signature = "def solve(values: list[int]):\n    pass";
  mocks.load.mockResolvedValue({ daily: { title: "Signal", difficulty: "easy", statement: "Solve it", function_signature: signature }, recent: [], streak: 0 });
  render(await Home());
  const region = screen.getByRole("region", { name: "Daily challenge function signature" });
  expect(region).toHaveAttribute("tabindex", "0");
  expect(region).toHaveAccessibleDescription(/focus the code and use the arrow keys/);
  expect(region.textContent).toBe(signature);
});
it("omits signature controls when no daily challenge is available", async () => {
  render(await Home());
  expect(screen.queryByRole("region", { name: "Daily challenge function signature" })).not.toBeInTheDocument();
  expect(screen.queryByText(/Keyboard: focus the code/)).not.toBeInTheDocument();
});

it.each([false, true])("explains ordered best-attempt scoring for signedIn=%s", async signedIn => {
  mocks.current.mockResolvedValue(signedIn ? { id: "one", username: "Ada", rating: 800 } : null);
  render(await Home());
  const rules = screen.getByRole("list", { name: "Duel scoring priority" });
  expect(rules.tagName).toBe("OL");
  expect(rules).toHaveAccessibleDescription(/best judged attempt counts.*weaker later attempt does not replace it/i);
  const steps = rules.querySelectorAll(":scope > li");
  expect(steps).toHaveLength(3);
  expect(steps[0]).toHaveTextContent("Pass the most hidden tests");
  expect(steps[1]).toHaveTextContent("median of three runs: the middle CPU time");
  expect(steps[2]).toHaveTextContent("earlier submission of the selected attempt");
  expect(steps[2]).toHaveTextContent("An exact tie is a draw");
});


it.each([
  [999.9, "Bronze"], [1000, "Silver"], [1199.9, "Silver"], [1200, "Gold"],
  [1599.9, "Gold"], [1600, "Platinum"], [1999.9, "Platinum"], [2000, "Diamond"],
  [2399.9, "Diamond"], [2400, "Master"],
])("shows the current home tier at full precision for %s MMR", async (rating, tier) => {
  mocks.current.mockResolvedValue({ id: "one", username: "Ada", rating });
  const { container } = render(await Home());
  const card = container.querySelector(".home-ladder")!;
  expect(card.querySelector(".badge")).toHaveTextContent(tier);
  expect(card.querySelector("h2")).toHaveTextContent(`${Math.round(rating)} MMR`);
  expect(card).toHaveTextContent("Displayed ratings are rounded.");
});

it("does not assign a personal tier to guests or unavailable dashboards", async () => {
  const view = render(await Home());
  expect(view.container.querySelector(".home-ladder .badge")).toBeNull();
  mocks.load.mockRejectedValueOnce(new Error("private"));
  view.rerender(await Home());
  expect(view.container.querySelector(".home-ladder")).toBeNull();
});

it.each([false, true])("offers signed-in history navigation with recent matches=%s", async populated => {
  mocks.current.mockResolvedValue({ id: "one", username: "A da", rating: 800 });
  mocks.load.mockResolvedValue({ daily: null, streak: 0, recent: populated ? [{ id: "m", title: "Pairs", opponent: "Bob", winner_id: "one" }] : [] });
  render(await Home());
  expect(screen.getByRole("link", { name: "View your duel history" })).toHaveAttribute("href", "/profile/A%20da");
  expect(screen.getByText(/Your latest five completed duels/)).toHaveTextContent("Your profile shows up to 20");
});
it("omits personal history navigation for guests and unavailable dashboards", async () => {
  const view = render(await Home());
  expect(screen.queryByRole("link", { name: "View your duel history" })).not.toBeInTheDocument();
  mocks.current.mockResolvedValue({ id: "one", username: "Ada", rating: 800 });
  mocks.load.mockRejectedValue(new Error("unavailable"));
  view.rerender(await Home());
  expect(screen.queryByRole("link", { name: "View your duel history" })).not.toBeInTheDocument();
  expect(screen.queryByText(/Your latest five completed duels/)).not.toBeInTheDocument();
});

it("shows the saved completion time beside its recent duel", async () => {
  mocks.current.mockResolvedValue({ id: "one", username: "Ada", rating: 800 });
  mocks.load.mockResolvedValue({ daily: null, streak: 1, recent: [{ id: "m", title: "Pairs", winner_id: "one", opponent: "Bob", completed_at: new Date("2026-11-06T23:05:00Z") }] });
  const { container } = render(await Home());
  const row = container.querySelector(".recent-duels li")!;
  expect(row).toHaveTextContent("Pairs");
  expect(row).toHaveTextContent("Completed Nov 6, 2026, 23:05 UTC");
  expect(row.querySelector("time")).toHaveAttribute("dateTime", "2026-11-06T23:05:00.000Z");
});

it("keeps daily constraints intact as plain text within the preview disclosure", async () => {
  const constraints = "1 <= n <= 100000\n  values[i] < 10\n<script>unsafe()</script>";
  mocks.load.mockResolvedValue({ daily: { title: "Signal", difficulty: "easy", statement: "Find a signal", function_signature: "def signal(a):", constraints }, recent: [], streak: 0 });
  const { container } = render(await Home());
  const panel = screen.getByRole("region", { name: "Input constraints", hidden: true });
  expect(panel.querySelector(".daily-constraints-text")?.textContent).toBe(constraints);
  expect(panel.closest("details")).toBe(container.querySelector(".daily-statement"));
  expect(panel.querySelector("script")).toBeNull();
  expect(panel).toHaveTextContent("Use the largest allowed inputs to plan your solution.");
});
it.each([undefined, "", "  "])("omits absent daily constraints (%s) without inventing limits", async constraints => {
  mocks.load.mockResolvedValue({ daily: { title: "Signal", difficulty: "easy", statement: "Find a signal", function_signature: "def signal(a):", constraints }, recent: [], streak: 0 });
  const { container } = render(await Home());
  expect(container.querySelector(".daily-constraints")).toBeNull();
});

it("shows only public daily examples as safely rendered input/output cards", async () => {
  mocks.load.mockResolvedValue({ daily: { title: "Signal", statement: "Solve it", difficulty: "easy", function_signature: "def solve(values):", examples: [{ args: [[1, 2]], expected: 3, explanation: "Sum the values.\n<script>bad()</script>" }] }, recent: [], streak: 0 });
  const { container } = render(await Home());
  const section = screen.getByRole("region", { name: "Public examples", hidden: true });
  expect(section).toHaveTextContent("separate hidden tests");
  expect(screen.getByRole("region", { name: "Example 1 input", hidden: true }).textContent).toBe(JSON.stringify([[1, 2]], null, 2));
  expect(screen.getByRole("region", { name: "Example 1 expected output", hidden: true })).toHaveTextContent("3");
  expect(section).toHaveTextContent("<script>bad()</script>");
  expect(container.querySelector("script")).toBeNull();
});
it.each([undefined, [], null])("omits unavailable daily examples (%s)", async examples => {
  mocks.load.mockResolvedValue({ daily: { title: "Signal", statement: "Solve it", difficulty: "easy", function_signature: "def solve():", examples }, recent: [], streak: 0 });
  render(await Home());
  expect(screen.queryByRole("region", { name: "Public examples", hidden: true })).not.toBeInTheDocument();
});

it("renders daily topics as safe, labeled study tags", async () => {
  mocks.load.mockResolvedValue({ daily: { title: "Signal", difficulty: "easy", statement: "Solve it", function_signature: "def solve():", topics: ["arrays", "<script>bad()</script>"] }, recent: [], streak: 0 });
  const { container } = render(await Home());
  const topics = screen.getByRole("list", { name: "Daily challenge topics" });
  expect(topics.children).toHaveLength(2);
  expect(topics.textContent).toBe("arrays<script>bad()</script>");
  expect(container.querySelector("script")).toBeNull();
  expect(screen.getByText("Practice topics")).toBeVisible();
});
it.each([undefined, [], null])("omits absent daily topic tags (%s)", async topics => {
  mocks.load.mockResolvedValue({ daily: { title: "Signal", difficulty: "easy", statement: "Solve it", function_signature: "def solve():", topics }, recent: [], streak: 0 });
  render(await Home());
  expect(screen.queryByRole("list", { name: "Daily challenge topics" })).not.toBeInTheDocument();
  expect(screen.queryByText("Practice topics")).not.toBeInTheDocument();
});

it.each([0, 1, 12])("explains the signed-in current streak of %s with semantic statistics", async streak => {
  mocks.current.mockResolvedValue({ id: "one", username: "Ada", rating: 800 });
  mocks.load.mockResolvedValue({ daily: null, recent: [], streak });
  const { container } = render(await Home());
  const stat = container.querySelector(".home-streak dl")!;
  expect(stat.querySelector("dt")).toHaveTextContent("Current win streak");
  expect(stat.querySelector("dd")).toHaveTextContent(`${streak} consecutive ${streak === 1 ? "win" : "wins"}`);
  expect(stat).toHaveAccessibleDescription("Consecutive wins across your completed duels. A loss or draw resets the count; cancelled reservations do not count.");
  expect(!!screen.queryByText("Your next win starts a new streak.")).toBe(streak === 0);
});
it("does not invent a guest streak", async () => {
  const { container } = render(await Home());
  expect(container.querySelector(".home-streak")).toBeNull();
  expect(screen.getByText(/Your starting rating. Sign in/)).toBeVisible();
});

it.each([[12.6, "+13 MMR change"], [-8.7, "-9 MMR change"], [0, "0 MMR change"], [-0.2, "0 MMR change"], [null, "Rating change unavailable"], [undefined, "Rating change unavailable"]])("shows personal recent-duel rating change %s", async (delta, label) => {
  mocks.current.mockResolvedValue({ id: "one", username: "Ada", rating: 800 });
  mocks.load.mockResolvedValue({ daily: null, streak: 0, recent: [{ id: "m", title: "Pairs", opponent: "Bob", winner_id: "one", delta }] });
  render(await Home());
  expect(screen.getByText(label)).toHaveClass("home-rating-change");
  expect(screen.getByText(/a displayed zero can include a small gain or loss/)).toBeVisible();
});

it("jumps directly to populated signed-in dashboard history", async () => {
  mocks.current.mockResolvedValue({ id: "one", username: "Ada", rating: 800 });
  mocks.load.mockResolvedValue({ daily: null, streak: 0, recent: [{ id: "m", title: "Pairs", opponent: "Bob", winner_id: "one" }] });
  render(await Home());
  expect(screen.getByRole("link", { name: "Jump to recent duels" })).toHaveAttribute("href", "#home-recent-duels-title");
  expect(screen.getByRole("heading", { name: "Recent duels" })).toHaveAttribute("id", "home-recent-duels-title");
  expect(screen.getByRole("heading", { name: "Recent duels" })).toHaveAttribute("tabindex", "-1");
});
it.each(["guest", "empty", "unavailable"])("omits dashboard history shortcut for %s", async mode => {
  if (mode !== "guest") mocks.current.mockResolvedValue({ id: "one", username: "Ada", rating: 800 });
  if (mode === "unavailable") mocks.load.mockRejectedValue(new Error("offline"));
  render(await Home());
  expect(screen.queryByRole("link", { name: "Jump to recent duels" })).not.toBeInTheDocument();
});

it.each([
  [999.75, "Bronze"], [1000, "Silver"], [1199.75, "Silver"], [1200, "Gold"],
  [1599.75, "Gold"], [1600, "Platinum"], [1999.75, "Platinum"], [2000, "Diamond"],
  [2399.75, "Diamond"], [2400, "Master"],
])("explains dashboard tiers at full precision for %s MMR", async (rating, tier) => {
  mocks.current.mockResolvedValue({ id: "one", username: "Ada", rating });
  const { container } = render(await Home());
  const guide = container.querySelector("details.tier-guide")!;
  expect(guide).not.toHaveAttribute("open");
  expect(guide.querySelector("summary")).toHaveTextContent("Explore rating tiers");
  const rows = within(guide as HTMLElement).getAllByRole("listitem", { hidden: true });
  expect(rows).toHaveLength(6);
  expect(guide.querySelectorAll(".tier-guide-current")).toHaveLength(1);
  expect(guide.querySelector(".tier-guide-current")).toHaveTextContent(tier);
  expect(guide).toHaveTextContent("even when the displayed MMR rounds up");
  expect(guide).toHaveTextContent("Refresh this dashboard");
});
it.each(["guest", "unavailable"])("omits personal dashboard tier guidance for %s", async mode => {
  if (mode === "unavailable") {
    mocks.current.mockResolvedValue({ id: "one", username: "Ada", rating: 800 });
    mocks.load.mockRejectedValue(new Error("private"));
  }
  const { container } = render(await Home());
  expect(container.querySelector(".tier-guide")).toBeNull();
});


it.each([false, true])("offers daily challenge access for signed-in=%s", async signedIn => {
  if (signedIn) mocks.current.mockResolvedValue({ id: "one", username: "Ada", rating: 800 });
  mocks.load.mockResolvedValue({ daily: { title: "Signal", difficulty: "easy", statement: "Solve it", function_signature: "def solve():" }, recent: [], streak: 0 });
  render(await Home());
  expect(screen.getByRole("link", {name: "Jump to daily challenge"})).toHaveAttribute("href", "#home-daily-challenge-title");
  expect(screen.getByRole("heading", {name: "Signal"})).toHaveAttribute("tabindex", "-1");
});
it.each([false, true])("omits daily shortcut when unavailable=%s and no preview exists", async unavailable => {
  if (unavailable) mocks.load.mockRejectedValue(new Error("private"));
  render(await Home());
  expect(screen.queryByRole("link", {name: "Jump to daily challenge"})).not.toBeInTheDocument();
});
