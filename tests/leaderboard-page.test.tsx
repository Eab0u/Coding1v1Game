import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
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
  const guide = screen.getByRole("region", { name: "How the weekly climb works" });
  expect(guide.querySelectorAll("dt")).toHaveLength(3);
  expect(guide).toHaveTextContent("+12 and -7 give a weekly gain of +5 MMR");
  expect(guide).toHaveTextContent("Zero or negative weekly gains stay on the ladder");
  expect(guide).toHaveTextContent("Weekly rank uses Weekly gain");
});

it.each(["global", "unavailable", "signed-out"])("omits weekly scoring guidance for %s states", async state => {
  if (state === "unavailable") mocks.load.mockRejectedValue(new Error("private"));
  if (state === "signed-out") mocks.current.mockResolvedValue(null);
  render(await Leaderboard({ searchParams: Promise.resolve({ period: state === "global" ? "global" : "weekly", scope: "friends" }) }));
  expect(screen.queryByRole("region", { name: "How the weekly climb works" })).not.toBeInTheDocument();
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
