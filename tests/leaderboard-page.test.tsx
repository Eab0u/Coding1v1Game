import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn(), current: vi.fn() }));
vi.mock("../src/lib/auth-server", () => ({ database: () => ({}), auth: { current: mocks.current } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../src/lib/leaderboard", () => ({ loadLeaderboard: mocks.load }));
import Leaderboard from "../src/app/leaderboard/page";
beforeEach(() => { mocks.load.mockResolvedValue([]); mocks.current.mockResolvedValue({ id: "player" }); });
it.each([{}, { period: "weekly" }, { scope: "friends" }, { period: "weekly", scope: "friends" }])("offers a native standings shortcut for populated filters %j", async filters => {
  mocks.load.mockResolvedValue([{ username: "Ada", rating: 800, score: 0, rank: 1 }]);
  render(await Leaderboard({ searchParams: Promise.resolve(filters) }));
  const jump = screen.getByRole("link", { name: "Jump to standings" });
  expect(jump).toHaveAttribute("href", "#standings-summary-title");
  expect(jump).toHaveClass("button--secondary");
  const heading = document.getElementById("standings-summary-title")!;
  expect(heading.tagName).toBe("H2");
  expect(heading).toHaveAttribute("tabindex", "-1");
  expect(heading).toHaveTextContent(filters.period === "weekly" ? "Weekly climb" : "Global rating");
  expect(jump.compareDocumentPosition(screen.getByRole("navigation", { name: "Leaderboard period" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it.each(["empty", "unavailable", "signed-out"])("omits the standings shortcut with no destination in %s state", async mode => {
  if (mode === "unavailable") mocks.load.mockRejectedValue(new Error("private"));
  if (mode === "signed-out") mocks.current.mockResolvedValue(null);
  render(await Leaderboard({ searchParams: Promise.resolve({ scope: "friends" }) }));
  expect(screen.queryByRole("link", { name: "Jump to standings" })).not.toBeInTheDocument();
  expect(document.getElementById("standings-summary-title")).toBeNull();
});
it("offers accessible period links and honest empty states", async () => {
  render(await Leaderboard({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("link", { name: "Global rating" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByText("The first rivals are on their way.")).toBeVisible();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});
it("renders weekly standings and signed gains", async () => {
  mocks.load.mockResolvedValue([{username:"Ada", rating:912.4, score:12.4, rank:1}]);
  render(await Leaderboard({ searchParams: Promise.resolve({period:"weekly"}) }));
  expect(mocks.load).toHaveBeenCalledWith({}, "weekly");
  expect(screen.getByRole("table", {name:"Weekly climb standings"})).toBeVisible();
  expect(screen.getByRole("rowheader", {name:"Ada"})).toBeVisible();
  expect(screen.getByText("+12 MMR")).toBeVisible();
  expect(document.getElementById("ranking-rules")).toHaveTextContent("Monday 00:00 UTC");
});

it.each([[12.4, "+12 MMR"], [-12.4, "-12 MMR"], [0.4, "0 MMR"], [-0.4, "0 MMR"], [0, "0 MMR"]])("rounds weekly change %s before choosing its sign", async (score, label) => {
  mocks.load.mockResolvedValue([{ username: "Ada", rating: 912.4, score, rank: 1 }]);
  render(await Leaderboard({ searchParams: Promise.resolve({ period: "weekly" }) }));
  expect(screen.getByText(label)).toBeVisible();
  expect(screen.getByText("912 MMR")).toBeVisible();
  expect(screen.getByRole("region", { name: "Leaderboard standings" })).toHaveAccessibleDescription(/scroll sideways.*arrow keys/);
  expect(screen.getByRole("link", { name: "Ada" })).toHaveClass("standings-player");
});

it("omits table scroll guidance when no standings are available", async () => {
  render(await Leaderboard({ searchParams: Promise.resolve({}) }));
  expect(screen.queryByText(/Keyboard: focus the standings/)).not.toBeInTheDocument();
});
it("falls back to global for unknown periods and contains database errors", async () => {
  mocks.load.mockRejectedValue(new Error("SECRET"));
  render(await Leaderboard({ searchParams: Promise.resolve({period:"invalid"}) }));
  expect(mocks.load).toHaveBeenCalledWith({}, "global");
  expect(screen.getByRole("alert")).toHaveTextContent("Standings unavailable");
  expect(screen.queryByText(/SECRET/)).not.toBeInTheDocument();
  expect(screen.queryByText("The first rivals are on their way.")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Retry standings" })).toHaveAttribute("href", "/leaderboard?period=global");
});

it.each(["global", "weekly"])("preserves the %s friends ladder when retrying a failed read", async period => {
  mocks.load.mockRejectedValue(new Error("private database details"));
  render(await Leaderboard({ searchParams: Promise.resolve({ period, scope: "friends" }) }));
  expect(mocks.load).toHaveBeenCalledWith({}, period, "player");
  expect(screen.getByRole("alert")).toHaveTextContent("Standings unavailable");
  const retry = screen.getByRole("link", { name: "Retry standings" });
  expect(retry).toHaveAttribute("href", `/leaderboard?period=${period}&scope=friends`);
  expect(retry).toHaveClass("button--primary");
  expect(screen.getByRole("link", { name: "Back to arena" })).toHaveAttribute("href", "/");
  expect(screen.queryByText(/private database/)).not.toBeInTheDocument();
});

it("keeps signed-out friends standings as a sign-in state without a retry", async () => {
  mocks.current.mockResolvedValue(null);
  render(await Leaderboard({ searchParams: Promise.resolve({ scope: "friends" }) }));
  expect(screen.getByRole("link", { name: "Sign in to see friends standings" })).toBeVisible();
  expect(screen.queryByRole("link", { name: "Retry standings" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Sign in to see friends standings" })).toHaveClass("button--primary");
  expect(screen.getByRole("link", { name: "See everyone" })).toHaveAttribute("href", "/leaderboard?period=global");
  expect(mocks.load).not.toHaveBeenCalled();
});

it.each(["global", "weekly"])("guides signed-in players through empty %s friends standings", async period => {
  render(await Leaderboard({ searchParams: Promise.resolve({ period, scope: "friends" }) }));
  expect(mocks.load).toHaveBeenCalledWith({}, period, "player");
  expect(screen.getByRole("region", { name: period === "weekly" ? "Your circle’s next climb starts here." : "Bring your rivals to the ladder." })).toBeVisible();
  expect(screen.getByRole("link", { name: "Find a duel" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "Invite friends" })).toHaveAttribute("href", "/friends");
  expect(screen.queryByText(/Create an account/)).not.toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  if (period === "weekly") expect(screen.getByText(/wins, losses and draws all count/)).toBeVisible();
});

it("preserves weekly selection when guests leave friends standings", async () => {
  mocks.current.mockResolvedValue(null);
  render(await Leaderboard({ searchParams: Promise.resolve({ period: "weekly", scope: "friends" }) }));
  expect(screen.getByRole("link", { name: "See everyone" })).toHaveAttribute("href", "/leaderboard?period=weekly");
  expect(screen.queryByRole("link", { name: "Find a duel" })).not.toBeInTheDocument();
});

it.each(["global", "weekly"])("guides visitors through empty public %s standings without private account reads", async period => {
  render(await Leaderboard({ searchParams: Promise.resolve({ period }) }));
  const panel = screen.getByRole("region", { name: period === "weekly" ? "A new week. An open ladder." : "The first rivals are on their way." });
  expect(panel).toBeVisible();
  expect(screen.getByRole("link", { name: "Find a duel" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "Sign in or create an account" })).toHaveAttribute("href", "/account");
  expect(screen.getByRole("link", { name: "Find a duel" })).toHaveClass("button--primary");
  expect(mocks.current).not.toHaveBeenCalled();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByText(period === "weekly" ? /Wins, losses and draws all count/ : /New accounts start at 800 MMR/)).toBeVisible();
});

it.each(["global", "weekly"])("summarizes the selected %s friends ladder and singular count", async period => {
  mocks.load.mockResolvedValue([{ username: "Ada", rating: 912, score: 12, rank: 1 }]);
  render(await Leaderboard({ searchParams: Promise.resolve({ period, scope: "friends" }) }));
  const summary = screen.getByRole("region", { name: period === "weekly" ? "Weekly climb" : "Global rating" });
  expect(summary).toHaveTextContent("YOUR CIRCLE");
  expect(summary).toHaveTextContent("1 player shown");
  expect(summary).toHaveTextContent("Showing all qualifying players in this ladder.");
  expect(summary).toHaveTextContent("Includes you and your accepted friends.");
});

it.each([2, 100])("explains the public ladder count and limit for %s rows", async count => {
  mocks.load.mockResolvedValue(Array.from({ length: count }, (_, i) => ({ username: `Player${i}`, rating: 900, score: 900, rank: 1 })));
  render(await Leaderboard({ searchParams: Promise.resolve({}) }));
  const summary = screen.getByRole("region", { name: "Global rating" });
  expect(summary).toHaveTextContent(`${count} players shown`);
  expect(summary).toHaveTextContent("EVERYONE");
  expect(summary).toHaveTextContent("Includes players across CodeDuel.");
  expect(summary).toHaveTextContent(count === 100 ? "Showing the top 100 players. More players may qualify" : "Showing all qualifying players");
});

it.each(["empty", "unavailable", "signed-out"])("omits the populated summary for %s standings", async state => {
  if (state === "unavailable") mocks.load.mockRejectedValue(new Error("private"));
  if (state === "signed-out") mocks.current.mockResolvedValue(null);
  render(await Leaderboard({ searchParams: Promise.resolve({ scope: "friends" }) }));
  expect(screen.queryByRole("region", { name: "Global rating" })).not.toBeInTheDocument();
  expect(screen.queryByText(/players? shown/)).not.toBeInTheDocument();
});

it.each(["public", "friends", "empty"])("explains weekly scoring for %s standings", async state => {
  if (state !== "empty") mocks.load.mockResolvedValue([{ username: "Ada", rating: 912, score: -7, rank: 1 }]);
  render(await Leaderboard({ searchParams: Promise.resolve({ period: "weekly", ...(state === "friends" ? { scope: "friends" } : {}) }) }));
  const summary = screen.getByText("How the weekly climb works", { selector: "summary" });
  const guide = summary.closest("details")!;
  expect(guide).not.toHaveAttribute("open");
  expect(guide.querySelectorAll("dt")).toHaveLength(3);
  expect(guide).toHaveTextContent("+12 and -7 give a weekly gain of +5 MMR");
  expect(guide).toHaveTextContent("Zero or negative weekly gains stay on the ladder");
  expect(guide).toHaveTextContent("Weekly rank uses Weekly gain");
});

it.each(["global", "unavailable", "signed-out"])("omits weekly scoring guidance for %s states", async state => {
  if (state === "unavailable") mocks.load.mockRejectedValue(new Error("private"));
  if (state === "signed-out") mocks.current.mockResolvedValue(null);
  render(await Leaderboard({ searchParams: Promise.resolve({ period: state === "global" ? "global" : "weekly", scope: "friends" }) }));
  expect(screen.queryByText("How the weekly climb works", { selector: "summary" })).not.toBeInTheDocument();
});


it.each([
  [999.9, "Bronze"], [1000, "Silver"], [1199.9, "Silver"], [1200, "Gold"],
  [1599.9, "Gold"], [1600, "Platinum"], [1999.9, "Platinum"],
  [2000, "Diamond"], [2399.9, "Diamond"], [2400, "Master"],
])("uses full current rating %s for standings tier %s", async (rating, tier) => {
  mocks.load.mockResolvedValue([{ username: "Ada", rating, score: -30, rank: 1 }]);
  render(await Leaderboard({ searchParams: Promise.resolve({ period: "weekly", scope: "friends" }) }));
  const badge = screen.getByText(tier, { exact: true, selector: ".badge" });
  expect(badge).toHaveClass("badge--accent");
  expect(badge.closest("td")).toHaveTextContent(`${Math.round(rating)} MMR`);
  expect(document.getElementById("ranking-rules")).toHaveTextContent("Tier badges follow current MMR");
});

it("includes a current tier on the global ladder", async () => {
  mocks.load.mockResolvedValue([{ username: "Ada", rating: 800, score: 800, rank: 1 }]);
  render(await Leaderboard({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText("Bronze", { exact: true, selector: ".badge" })).toBeVisible();
});

it.each([{}, { period: "weekly" }, { scope: "friends" }, { period: "weekly", scope: "friends" }, { period: "invalid", scope: "invalid" }])("offers a native snapshot refresh preserving normalized filters %j", async filters => {
  render(await Leaderboard({ searchParams: Promise.resolve(filters) }));
  const refresh = screen.getByRole("link", { name: "Refresh standings" });
  expect(refresh).toHaveAttribute("href", `/leaderboard?period=${filters.period === "weekly" ? "weekly" : "global"}${filters.scope === "friends" ? "&scope=friends" : ""}`);
  expect(refresh).toHaveAccessibleDescription(/reflect when this page loaded.*selected filters stay in place/);
  expect(refresh).toHaveClass("button--secondary");
});

it.each(["unavailable", "signed-out"])("omits snapshot refresh for %s standings", async mode => {
  if (mode === "unavailable") mocks.load.mockRejectedValue(new Error("private"));
  else mocks.current.mockResolvedValue(null);
  render(await Leaderboard({ searchParams: Promise.resolve({ scope: "friends" }) }));
  expect(screen.queryByRole("link", { name: "Refresh standings" })).not.toBeInTheDocument();
  expect(screen.queryByText("Check the latest standings")).not.toBeInTheDocument();
});

 it.each(["global", "weekly"])("explains shared tier thresholds on the %s ladder even when empty", async period => {
  render(await Leaderboard({ searchParams: Promise.resolve({ period }) }));
  const guide = screen.getByText("Explore leaderboard rating tiers").closest("details")!;
  expect(guide).not.toHaveAttribute("open");
  const { RATING_TIERS } = await import("../src/lib/profile");
  const rows = guide.querySelectorAll("li");
  expect(rows).toHaveLength(RATING_TIERS.length);
  RATING_TIERS.forEach((tier, index) => {
    expect(rows[index]).toHaveTextContent(tier.name);
    expect(rows[index]).toHaveTextContent(`${tier.minimum}+ MMR`);
  });
  expect(guide).toHaveTextContent("Weekly gains determine weekly rank, but do not determine your tier");
  expect(guide).toHaveTextContent("999.75 MMR is Bronze");
  expect(guide).toHaveTextContent("Master has no upper limit");
 });
 it("keeps public tier guidance available when standings fail", async () => {
  mocks.load.mockRejectedValue(new Error("private"));
  render(await Leaderboard({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText("Explore leaderboard rating tiers")).toBeVisible();
 });

it.each(["everyone", "friends"])("distinguishes rounded weekly changes for %s and updates corrected snapshots", async scope => {
  const filters = { period: "weekly", ...(scope === "friends" ? { scope } : {}) };
  const view = render(await Leaderboard({ searchParams: Promise.resolve(filters) }));
  for (const [score, number, label, direction] of [
    [12.4, "+12 MMR", "Rounded gain", "gain"],
    [-12.4, "-12 MMR", "Rounded loss", "loss"],
    [0.4, "0 MMR", "No rounded change", "unchanged"],
    [-0.4, "0 MMR", "No rounded change", "unchanged"],
    [0, "0 MMR", "No rounded change", "unchanged"],
    [0.5, "+1 MMR", "Rounded gain", "gain"],
    [-0.5, "0 MMR", "No rounded change", "unchanged"],
    [-0.6, "-1 MMR", "Rounded loss", "loss"],
  ] as const) {
    mocks.load.mockResolvedValue([{ username: "Ada", rating: 912.4, score, rank: 1 }]);
    view.rerender(await Leaderboard({ searchParams: Promise.resolve(filters) }));
    const cell = screen.getByText(label).closest("td")!;
    expect(cell).toHaveClass(`standings-change--${direction}`);
    expect(cell).toHaveTextContent(number);
    expect(document.querySelectorAll(".standings-change")).toHaveLength(1);
    for (const other of ["gain", "loss", "unchanged"].filter(value => value !== direction)) {
      expect(document.querySelector(`.standings-change--${other}`)).toBeNull();
    }
  }
  view.rerender(await Leaderboard({ searchParams: Promise.resolve({}) }));
  expect(document.querySelector(".standings-change")).toBeNull();
  expect(screen.queryByText(/Rounded gain|Rounded loss|No rounded change/)).not.toBeInTheDocument();
});


afterEach(() => { vi.useRealTimers(); });
it.each([
  ["2026-11-08T23:59:59Z", "2026-11-02", "2026-11-09"],
  ["2026-11-09T00:00:00Z", "2026-11-09", "2026-11-16"],
  ["2027-01-01T03:00:00+05:00", "2026-12-28", "2027-01-04"],
  ["2028-02-29T12:00:00Z", "2028-02-28", "2028-03-06"],
])("shows UTC weekly boundaries at %s in both scopes", async (now, start, end) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  for (const scope of [undefined, "friends"]) {
    const view = render(await Leaderboard({ searchParams: Promise.resolve({ period: "weekly", scope }) }));
    const window = screen.getByText("Current UTC week").parentElement!;
    expect(Array.from(window.querySelectorAll("time"), time => time.dateTime)).toEqual([`${start}T00:00:00.000Z`, `${end}T00:00:00.000Z`]);
    expect(window).toHaveTextContent("00:00 UTC (exclusive). Refresh after the boundary");
    view.unmount();
  }
});
it.each(["global", "unavailable", "signed-out"])("withholds weekly window for %s standings", async state => {
  if (state === "unavailable") mocks.load.mockRejectedValue(new Error("offline"));
  if (state === "signed-out") mocks.current.mockResolvedValue(null);
  render(await Leaderboard({ searchParams: Promise.resolve({ period: state === "global" ? "global" : "weekly", scope: "friends" }) }));
  expect(screen.queryByText("Current UTC week")).not.toBeInTheDocument();
});


it.each([{}, { period: "weekly" }, { scope: "friends" }, { period: "weekly", scope: "friends" }])("explains shared places, precision and the cutoff for %j", async filters => {
  mocks.load.mockResolvedValue([
    { username: "Ada", rating: 1000.4, score: 12.4, rank: 1 },
    { username: "Zed", rating: 1000.4, score: 12.4, rank: 1 },
    { username: "Bob", rating: 1000.3, score: 12.3, rank: 3 },
  ]);
  render(await Leaderboard({ searchParams: Promise.resolve(filters) }));
  const summary = screen.getByText("How ranks and ties work");
  const guide = summary.closest("details")!;
  expect(summary.tagName).toBe("SUMMARY");
  expect(guide).not.toHaveAttribute("open");
  summary.click();
  expect(guide).toHaveAttribute("open");
  expect(guide).toHaveClass("rank-guide");
  expect(guide).toHaveTextContent("Two players tied at #1 are followed by #3");
  expect(guide).toHaveTextContent(`${filters.period === "weekly" ? "Weekly gains" : "Current ratings"} determine rank before rounding`);
  expect(guide).toHaveTextContent("Tied players are ordered alphabetically by username, including at the cutoff");
  expect(screen.getAllByText("#1")).toHaveLength(2);
  expect(screen.getByText("#3")).toBeVisible();
});

it.each(["empty", "unavailable", "signed-out"])("omits rank guidance without standings in %s state", async mode => {
  if (mode === "unavailable") mocks.load.mockRejectedValue(new Error("private"));
  if (mode === "signed-out") mocks.current.mockResolvedValue(null);
  render(await Leaderboard({ searchParams: Promise.resolve({ scope: "friends" }) }));
  expect(screen.queryByText("How ranks and ties work")).not.toBeInTheDocument();
});
