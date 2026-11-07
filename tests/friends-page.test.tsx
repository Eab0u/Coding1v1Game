import { fireEvent, render, screen, within } from "@testing-library/react";
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
  expect(screen.getByRole("link", {name:"Retry friends"})).toHaveAttribute("href", "/friends");
  expect(screen.getByRole("link", {name:"Back to arena"})).toHaveAttribute("href", "/");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
  expect(screen.queryByText(/No friends yet/)).not.toBeInTheDocument();
});

it("recovers friends on a fresh read and removes the retry after success", async () => {
  mocks.friends.mockRejectedValueOnce(new Error("private connection detail"));
  const view = render(await Friends({searchParams:Promise.resolve({})}));
  expect(screen.getByRole("link", {name:"Retry friends"})).toHaveAttribute("href", "/friends");
  mocks.friends.mockResolvedValue([{username:"Ada",status:"pending",incoming:true}]);
  view.rerender(await Friends({searchParams:Promise.resolve({})}));
  expect(mocks.current).toHaveBeenCalledTimes(2);
  expect(mocks.friends).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("region", {name:"Incoming requests 1"})).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("link", {name:"Retry friends"})).not.toBeInTheDocument();
});

it("offers recovery when session lookup fails without querying relationships", async () => {
  mocks.current.mockRejectedValue(new Error("private session detail"));
  render(await Friends({searchParams:Promise.resolve({})}));
  expect(screen.getByRole("alert")).toHaveTextContent("Friends unavailable");
  expect(screen.getByRole("link", {name:"Retry friends"})).toBeVisible();
  expect(screen.queryByText(/private session detail/)).not.toBeInTheDocument();
  expect(screen.queryByRole("link", {name:"Sign in to manage friends"})).not.toBeInTheDocument();
  expect(mocks.friends).not.toHaveBeenCalled();
});

it("groups relationships with counts and submits the clicked action for the correct player", async () => {
  mocks.friends.mockResolvedValue([
    {username:"Eve",status:"accepted",incoming:true},
    {username:"Bob",status:"pending",incoming:false},
    {username:"Ada",status:"pending",incoming:true},
    {username:"Zoe",status:"accepted",incoming:false},
  ]);
  render(await Friends({searchParams:Promise.resolve({})}));
  const incoming = screen.getByRole("region", {name:"Incoming requests 1"});
  const accepted = screen.getByRole("region", {name:"Your friends 2"});
  const outgoing = screen.getByRole("region", {name:"Sent requests 1"});
  expect(within(incoming).getByRole("link", {name:"Ada"})).toBeVisible();
  expect(within(accepted).getAllByRole("listitem")).toHaveLength(2);
  expect(within(outgoing).getByRole("link", {name:"Bob"})).toBeVisible();
  for (const [label, username, action] of [["Accept","Ada","accept"], ["Decline","Ada","remove"], ["Cancel request","Bob","remove"], ["Remove friend","Eve","remove"]]) {
    const form = screen.getByRole("form", {name:`Manage ${username}`}) as HTMLFormElement;
    const submit = vi.fn((event: Event) => event.preventDefault());
    form.addEventListener("submit", submit);
    const button = within(form).getByRole("button", {name:label}) as HTMLButtonElement;
    fireEvent.click(button);
    expect(submit).toHaveBeenCalledOnce();
    const event = submit.mock.calls[0][0] as SubmitEvent;
    expect(event.submitter).toBe(button);
    expect(new FormData(form).get("username")).toBe(username);
    expect(button.name).toBe("action");
    expect(button.value).toBe(action);
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/api/friends");
    form.removeEventListener("submit", submit);
  }
});
it("shows honest empty sections and hides private sections from guests", async () => {
  const view = render(await Friends({searchParams:Promise.resolve({})}));
  for (const name of ["Incoming requests 0", "Your friends 0", "Sent requests 0"]) expect(screen.getByRole("region", {name})).toBeVisible();
  expect(screen.getByText("No friends yet. Send a request to start your circle.")).toBeVisible();
  view.unmount();
  mocks.current.mockResolvedValue(null);
  mocks.friends.mockClear();
  render(await Friends({searchParams:Promise.resolve({})}));
  expect(screen.getByRole("link", {name:"Sign in to manage friends"})).toBeVisible();
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
  expect(mocks.friends).not.toHaveBeenCalled();
});
