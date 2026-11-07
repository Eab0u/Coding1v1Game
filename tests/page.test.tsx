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
