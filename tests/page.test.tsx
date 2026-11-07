import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ current: vi.fn(), load: vi.fn() }));
vi.mock("../src/lib/auth-server", () => ({ auth: { current: mocks.current }, database: () => ({}) }));
vi.mock("../src/lib/home", () => ({ loadHome: mocks.load }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
import Home from "../src/app/page";
beforeEach(() => { mocks.current.mockResolvedValue(null); mocks.load.mockResolvedValue({ daily: null, recent: [], streak: 0 }); });
it("offers guests a sign-in path and truthful empty states", async () => {
  render(await Home());
  expect(screen.getByRole("link", { name: "Sign in to play" })).toHaveAttribute("href", "/account");
  expect(screen.getByText(/validated catalog/)).toBeVisible();
  expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
});
it("shows real account stats, daily challenge and completed results", async () => {
  mocks.current.mockResolvedValue({ id: "one", username: "Ada", rating: 912.3 });
  mocks.load.mockResolvedValue({ streak: 3, daily: { title: "Signal", statement: "Find a signal", difficulty: "easy", function_signature: "def signal(a):" }, recent: [{ id: "m", title: "Pairs", winner_id: "one", opponent: "Bob" }] });
  render(await Home());
  expect(screen.getByText("3 consecutive wins")).toBeVisible();
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
  expect(screen.getByRole("link", { name: "Retry dashboard" })).toHaveAttribute("href", "/");
  expect(screen.queryByRole("link", { name: "Sign in to play" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Player dashboard" })).not.toBeInTheDocument();
});
it("hides invented empty stats after a dashboard failure and recovers on a fresh read", async () => {
  mocks.current.mockResolvedValue({ id: "one", username: "Ada", rating: 912.3 });
  mocks.load.mockRejectedValueOnce(new Error("private database details"));
  const view = render(await Home());
  expect(screen.getByRole("alert")).toHaveTextContent("Player dashboard unavailable");
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
