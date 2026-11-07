import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn(), current: vi.fn() }));
vi.mock("../src/lib/auth-server", () => ({ database: () => ({}), auth: { current: mocks.current } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../src/lib/leaderboard", () => ({ loadLeaderboard: mocks.load }));
import Leaderboard from "../src/app/leaderboard/page";
beforeEach(() => { mocks.load.mockResolvedValue([]); mocks.current.mockResolvedValue({ id: "player" }); });
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
  expect(screen.getByText("+12")).toBeVisible();
  expect(screen.getByText(/Monday 00:00 UTC/)).toBeVisible();
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

