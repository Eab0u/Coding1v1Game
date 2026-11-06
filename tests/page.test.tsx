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
  expect(screen.getByText("Signal")).toBeVisible();
  expect(screen.getByRole("button", { name: "Play a duel" })).toBeEnabled();
});
it("contains database errors without exposing secrets", async () => {
  mocks.current.mockRejectedValue(new Error("secret"));
  render(await Home());
  expect(screen.getByRole("alert")).toHaveTextContent("dashboard unavailable");
  expect(screen.queryByText("secret")).not.toBeInTheDocument();
});
