import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../src/lib/auth-server", () => ({ database: () => ({}) }));
vi.mock("../src/lib/leaderboard", () => ({ loadLeaderboard: mocks.load }));
import Leaderboard from "../src/app/leaderboard/page";
beforeEach(() => { mocks.load.mockResolvedValue([]); });
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
});

