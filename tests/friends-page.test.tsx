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
  expect(screen.getByRole("link",{name:"View Ada's profile"})).toHaveAttribute("href","/profile/Ada");
});
it("names and styles profile links across incoming, accepted and outgoing friends", async () => {
  mocks.friends.mockResolvedValue([{ username: "Ada", status: "pending", incoming: true }, { username: "Eve", status: "accepted", incoming: false }, { username: "Bob", status: "pending", incoming: false }]);
  render(await Friends({ searchParams: Promise.resolve({}) }));
  for (const username of ["Ada", "Eve", "Bob"]) {
    const link = screen.getByRole("link", { name: `View ${username}'s profile` });
    expect(link).toHaveAttribute("href", `/profile/${username}`);
    expect(link).toHaveClass("standings-player");
    expect(link).toHaveTextContent(username);
  }
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
  expect(within(incoming).getByRole("link", {name:"View Ada's profile"})).toBeVisible();
  expect(within(accepted).getAllByRole("listitem")).toHaveLength(2);
  expect(within(outgoing).getByRole("link", {name:"View Bob's profile"})).toBeVisible();
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

it("guides friend invitations, blocks invalid names and recovers with the exact requested player", async () => {
  render(await Friends({searchParams:Promise.resolve({})}));
  const input = screen.getByLabelText<HTMLInputElement>("Player username");
  expect(input).toHaveAccessibleDescription(/3.*24 letters, numbers or underscores for a player username/);
  expect(input).toHaveAttribute("autocapitalize", "none");
  expect(input).toHaveAttribute("spellcheck", "false");
  expect(input).toHaveAttribute("autocomplete", "off");
  fireEvent.invalid(input);
  expect(input).toHaveAttribute("aria-invalid", "true");
  for (const value of ["ab", "a".repeat(25), "Player Name", "Player-Name"]) {
    fireEvent.change(input, {target:{value}});
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription(/a player username/);
    expect(screen.getByRole("status")).not.toBeEmptyDOMElement();
  }
  fireEvent.change(input, {target:{value:"Ada_123"}});
  expect(input).toBeValid();
  expect(input).not.toHaveAttribute("aria-invalid");
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  const form = input.form!;
  expect(new FormData(form).get("username")).toBe("Ada_123");
  expect(new FormData(form).get("action")).toBe("request");
  expect(form).toHaveAttribute("action", "/api/friends");
});

it("guides guests to accounts and public standings without showing private controls", async () => {
  mocks.current.mockResolvedValue(null);
  render(await Friends({searchParams:Promise.resolve({})}));
  expect(screen.getByRole("heading", {name:"Keep your rivals close."})).toBeVisible();
  expect(screen.getByText(/Friendships begin when the other player accepts/)).toBeVisible();
  expect(screen.getByRole("link", {name:"Sign in to manage friends"})).toHaveAttribute("href", "/account");
  expect(screen.getByRole("link", {name:"Explore public standings"})).toHaveAttribute("href", "/leaderboard");
  expect(screen.getByRole("link", {name:"Skip to friends"})).toHaveAttribute("href", "#main-content");
  expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Player username")).not.toBeInTheDocument();
  expect(screen.queryByText(/No friends yet/)).not.toBeInTheDocument();
  expect(mocks.friends).not.toHaveBeenCalled();
});
it.each([
  ["Friend list updated.", "Friend list updated", "Review your friends"],
  ["No request sent. Check the username or your existing relationships.", "No request sent", "Check the player username"],
  ["Friends unavailable. Please try again later.", "Action could not be confirmed", "before trying again"],
])("explains friend action result %s", async (message, title, guidance) => {
  render(await Friends({searchParams:Promise.resolve({message})}));
  const feedback = screen.getByRole("heading", {name:title}).closest("[role=status]")!;
  expect(feedback).toHaveTextContent(guidance);
  expect(feedback.parentElement).toHaveClass("friend-feedback");
});
it("ignores arbitrary URL messages and suppresses results when session or data is unavailable", async () => {
  const view = render(await Friends({searchParams:Promise.resolve({message:"Invented success message"})}));
  expect(screen.queryByText("Invented success message")).not.toBeInTheDocument();
  mocks.current.mockResolvedValue(null);
  view.rerender(await Friends({searchParams:Promise.resolve({message:"Friend list updated."})}));
  expect(screen.queryByText("Friend list updated")).not.toBeInTheDocument();
  mocks.current.mockResolvedValue({id:"actor"});
  mocks.friends.mockRejectedValue(new Error("private"));
  view.rerender(await Friends({searchParams:Promise.resolve({message:"Friend list updated."})}));
  expect(screen.queryByText("Friend list updated")).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Friends unavailable");
});
