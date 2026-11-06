import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ current: vi.fn(), friends: vi.fn(), standings: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({value:"token"}) }) }));
vi.mock("../src/lib/auth-server", () => ({ auth:{current:mocks.current}, database: () => ({}) }));
vi.mock("../src/lib/friends", () => ({ loadFriends: mocks.friends }));
vi.mock("../src/lib/leaderboard", () => ({ loadLeaderboard: mocks.standings }));
import Friends from "../src/app/friends/page";
import Leaderboard from "../src/app/leaderboard/page";
beforeEach(() => { vi.resetAllMocks(); mocks.current.mockResolvedValue({id:"actor"}); mocks.friends.mockResolvedValue([]); mocks.standings.mockResolvedValue([]); });
it("shows invitation, incoming consent, outgoing cancellation and removal controls", async () => {
  mocks.friends.mockResolvedValue([{username:"Ada",status:"pending",incoming:true},{username:"Bob",status:"pending",incoming:false},{username:"Eve",status:"accepted",incoming:true}]);
  render(await Friends({searchParams:Promise.resolve({})}));
  expect(screen.getByLabelText("Player username")).toBeRequired();
  for (const name of ["Accept","Decline","Cancel request","Remove friend"]) expect(screen.getByRole("button",{name})).toBeVisible();
  expect(screen.getByRole("link",{name:"Ada"})).toHaveAttribute("href","/profile/Ada");
});
it("keeps both leaderboard filters and derives the friend scope from the session", async () => {
  render(await Leaderboard({searchParams:Promise.resolve({scope:"friends",period:"weekly"})}));
  expect(mocks.standings).toHaveBeenCalledWith({},"weekly","actor");
  expect(screen.getByRole("link",{name:"Global rating"})).toHaveAttribute("href","/leaderboard?scope=friends");
  expect(screen.getByRole("link",{name:"Friends"})).toHaveAttribute("aria-current","page");
});
it("requires login for private standings without querying another player's circle", async () => {
  mocks.current.mockResolvedValue(null);
  render(await Leaderboard({searchParams:Promise.resolve({scope:"friends"})}));
  expect(screen.getByRole("link",{name:"Sign in to see friends standings"})).toBeVisible();
  expect(mocks.standings).not.toHaveBeenCalled();
});
it("contains private service failures", async () => {
  mocks.friends.mockRejectedValue(new Error("SECRET"));
  render(await Friends({searchParams:Promise.resolve({})}));
  expect(screen.getByRole("alert")).toHaveTextContent("Friends unavailable");
  expect(screen.queryByText(/SECRET/)).not.toBeInTheDocument();
});
