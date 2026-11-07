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
it("offers scoped rating and weekly comparisons only when accepted friends exist", async () => {
  mocks.friends.mockResolvedValue([{username:"Ada", rating:1200, status:"pending", incoming:true}]);
  const view = render(await Friends({searchParams:Promise.resolve({})}));
  expect(screen.queryByRole("link", {name:"Compare friends ratings"})).not.toBeInTheDocument();
  mocks.friends.mockResolvedValue([{username:"Ada", rating:1200, status:"accepted", incoming:false}]);
  view.rerender(await Friends({searchParams:Promise.resolve({})}));
  const section = screen.getByRole("region", {name:"Your friends 1"});
  const ratings = within(section).getByRole("link", {name:"Compare friends ratings"});
  const weekly = within(section).getByRole("link", {name:"Compare friends this week"});
  expect(ratings).toHaveAttribute("href", "/leaderboard?scope=friends");
  expect(weekly).toHaveAttribute("href", "/leaderboard?scope=friends&period=weekly");
  expect(weekly).toHaveAccessibleDescription(/Monday 00:00 UTC.*Only players with completed duels this week/);
  expect(ratings).toHaveAccessibleDescription(/global standings rank current MMR/);
  mocks.friends.mockResolvedValue([]);
  view.rerender(await Friends({searchParams:Promise.resolve({})}));
  expect(screen.queryByRole("link", {name:"Compare friends this week"})).not.toBeInTheDocument();
});
it("offers a fresh native page read with snapshot guidance only for available private lists", async () => {
  const view = render(await Friends({searchParams:Promise.resolve({message:"Friend list updated."})}));
  const refresh = screen.getByRole("link", {name:"Refresh friends"});
  expect(refresh).toHaveAttribute("href", "/friends");
  expect(refresh).toHaveAccessibleDescription("Invitations, friendships and player ratings reflect when this page loaded. Refresh to see new replies and current ratings.");
  expect(refresh).toHaveClass("button", "button--secondary");
  mocks.friends.mockResolvedValue([{username:"NewReply", rating:1200, status:"accepted", incoming:false}]);
  view.rerender(await Friends({searchParams:Promise.resolve({})}));
  expect(screen.getByRole("link", {name:"View NewReply's profile"})).toBeVisible();
  expect(screen.queryByRole("heading", {name:"Friend list updated"})).not.toBeInTheDocument();
  mocks.current.mockResolvedValue(null);
  view.rerender(await Friends({searchParams:Promise.resolve({})}));
  expect(screen.queryByRole("link", {name:"Refresh friends"})).not.toBeInTheDocument();
  mocks.current.mockResolvedValue({id:"actor"});
  mocks.friends.mockRejectedValue(new Error("unavailable"));
  view.rerender(await Friends({searchParams:Promise.resolve({})}));
  expect(screen.queryByRole("link", {name:"Refresh friends"})).not.toBeInTheDocument();
});
it("explains invitation consent, reversible requests and mutual removal before management controls", async () => {
  const view = render(await Friends({searchParams:Promise.resolve({})}));
  const guide = screen.getByRole("heading", {name:"How your circle works"}).parentElement!;
  expect(guide).toHaveClass("friend-guide");
  expect(within(guide).getAllByRole("term")).toHaveLength(3);
  expect(within(guide).getAllByRole("definition")).toHaveLength(3);
  expect(guide).toHaveTextContent("The recipient must choose Accept, even if you both send requests.");
  expect(guide).toHaveTextContent("Decline dismisses an incoming invitation. Cancel request withdraws an invitation you sent.");
  expect(guide).toHaveTextContent("Remove friend removes the relationship for both players.");
  expect(guide).toHaveTextContent("To reconnect, send a new invitation and wait for acceptance.");
  expect(guide).toHaveTextContent("Pending invitations do not count.");
  expect(guide.compareDocumentPosition(screen.getByLabelText("Player username")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  mocks.current.mockResolvedValue(null);
  view.rerender(await Friends({searchParams:Promise.resolve({})}));
  expect(screen.queryByRole("heading", {name:"How your circle works"})).not.toBeInTheDocument();
  mocks.current.mockResolvedValue({id:"actor"});
  mocks.friends.mockRejectedValue(new Error("unavailable"));
  view.rerender(await Friends({searchParams:Promise.resolve({})}));
  expect(screen.queryByRole("heading", {name:"How your circle works"})).not.toBeInTheDocument();
});
it("links counted friend sections to focusable destinations and highlights waiting replies", async () => {
  mocks.friends.mockResolvedValue([{username:"Ada",rating: 999.75, status:"pending",incoming:true},{username:"Eve",rating: 999.75, status:"accepted",incoming:false}]);
  const view = render(await Friends({searchParams:Promise.resolve({})}));
  const navigation = screen.getByRole("navigation", {name:"Friend sections"});
  for (const [title, id, count] of [["Incoming requests", "incoming", 1], ["Your friends", "accepted", 1], ["Sent requests", "outgoing", 0]]) {
    const link = within(navigation).getByRole("link", {name:`${title} ${count}`});
    const destination = screen.getByRole("region", {name:`${title} ${count}`});
    expect(link).toHaveAttribute("href", `#friend-section-${id}`);
    expect(destination).toHaveAttribute("id", `friend-section-${id}`);
    expect(destination).toHaveAttribute("tabindex", "-1");
    expect(link.classList.contains("friend-jump--pending")).toBe(id === "incoming");
  }
  mocks.friends.mockResolvedValue([]);
  view.rerender(await Friends({searchParams:Promise.resolve({})}));
  expect(screen.getByRole("link", {name:"Incoming requests 0"})).not.toHaveClass("friend-jump--pending");
  mocks.current.mockResolvedValue(null);
  view.rerender(await Friends({searchParams:Promise.resolve({})}));
  expect(screen.queryByRole("navigation", {name:"Friend sections"})).not.toBeInTheDocument();
  mocks.current.mockResolvedValue({id:"actor"});
  mocks.friends.mockRejectedValue(new Error("private"));
  view.rerender(await Friends({searchParams:Promise.resolve({})}));
  expect(screen.queryByRole("navigation", {name:"Friend sections"})).not.toBeInTheDocument();
});
it("shows invitation, incoming consent, outgoing cancellation and removal controls", async () => {
  mocks.friends.mockResolvedValue([{username:"Ada",rating: 999.75, status:"pending",incoming:true},{username:"Bob",rating: 999.75, status:"pending",incoming:false},{username:"Eve",rating: 999.75, status:"accepted",incoming:true}]);
  render(await Friends({searchParams:Promise.resolve({})}));
  expect(screen.getByLabelText("Player username")).toBeRequired();
  for (const name of ["Accept: Ada","Decline: Ada","Cancel request: Bob","Remove friend: Eve"]) expect(screen.getByRole("button",{name})).toBeVisible();
  expect(screen.getByRole("link",{name:"View Ada's profile"})).toHaveAttribute("href","/profile/Ada");
});
it("names and styles profile links across incoming, accepted and outgoing friends", async () => {
  mocks.friends.mockResolvedValue([{ username: "Ada", rating: 999.75, status: "pending", incoming: true }, { username: "Eve", rating: 999.75, status: "accepted", incoming: false }, { username: "Bob", rating: 999.75, status: "pending", incoming: false }]);
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
  mocks.friends.mockResolvedValue([{username:"Ada",rating: 999.75, status:"pending",incoming:true}]);
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
    {username:"Eve",rating: 999.75, status:"accepted",incoming:true},
    {username:"Bob",rating: 999.75, status:"pending",incoming:false},
    {username:"Ada",rating: 999.75, status:"pending",incoming:true},
    {username:"Zoe",rating: 999.75, status:"accepted",incoming:false},
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
    const button = within(form).getByRole("button", {name:`${label}: ${username}`}) as HTMLButtonElement;
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

it("identifies repeated friend actions by player and refreshes names after relationship changes", async () => {
  mocks.friends.mockResolvedValue([
    {username:"Ada",rating: 999.75, status:"pending",incoming:true},
    {username:"Grace",rating: 999.75, status:"pending",incoming:true},
    {username:"Bob",rating: 999.75, status:"pending",incoming:false},
    {username:"Eve",rating: 999.75, status:"accepted",incoming:false},
    {username:"Lin",rating: 999.75, status:"accepted",incoming:true},
  ]);
  const view = render(await Friends({searchParams:Promise.resolve({})}));
  for (const [username, labels] of [
    ["Ada", ["Accept", "Decline"]], ["Grace", ["Accept", "Decline"]],
    ["Bob", ["Cancel request"]], ["Eve", ["Remove friend"]], ["Lin", ["Remove friend"]],
  ] as const) {
    for (const label of labels) {
      const button = screen.getByRole("button", {name:`${label}: ${username}`});
      expect(button).toHaveTextContent(label);
      const form = button.closest("form")!;
      expect(form).toHaveAccessibleName(`Manage ${username}`);
      expect(new FormData(form).get("username")).toBe(username);
    }
  }
  mocks.friends.mockResolvedValue([{username:"Ada",rating: 999.75, status:"accepted",incoming:false}]);
  view.rerender(await Friends({searchParams:Promise.resolve({})}));
  expect(screen.getByRole("button", {name:"Remove friend: Ada"})).toBeVisible();
  expect(screen.queryByRole("button", {name:"Accept: Ada"})).not.toBeInTheDocument();
  expect(screen.queryByRole("button", {name:"Decline: Ada"})).not.toBeInTheDocument();
  expect(screen.queryByRole("button", {name:"Accept: Grace"})).not.toBeInTheDocument();
});

it("shows current rounded MMR with tiers selected before rounding for every relationship", async () => {
  mocks.friends.mockResolvedValue([
    {username:"Ada",rating:999.75,status:"pending",incoming:true},
    {username:"Bob",rating:1200,status:"accepted",incoming:false},
    {username:"Eve",rating:0,status:"pending",incoming:false},
  ]);
  const view = render(await Friends({searchParams:Promise.resolve({})}));
  for (const [username, mmr, tier] of [["Ada", "1000", "Bronze"], ["Bob", "1200", "Gold"], ["Eve", "0", "Bronze"]]) {
    const card = screen.getByRole("link", {name:`View ${username}'s profile`}).closest("li")!;
    const rating = card.querySelector(".friend-rating")!;
    expect(rating).toHaveTextContent(`${mmr} MMR`);
    expect(rating).toHaveTextContent(tier);
    expect(rating).toHaveAccessibleDescription("Player cards show current MMR rounded to a whole number. Tiers use the full rating before rounding.");
  }
  mocks.friends.mockResolvedValue([{username:"Ada",rating:1000,status:"accepted",incoming:false}]);
  view.rerender(await Friends({searchParams:Promise.resolve({})}));
  expect(screen.getByRole("link", {name:"View Ada's profile"}).closest("li")).toHaveTextContent("Silver");
  mocks.current.mockResolvedValue(null);
  view.rerender(await Friends({searchParams:Promise.resolve({})}));
  expect(view.container.querySelector(".friend-rating")).toBeNull();
  expect(screen.queryByText(/Player cards show current MMR/)).not.toBeInTheDocument();
});

it("guides empty friend sections toward invitations or waiting replies", async () => {
  const view = render(await Friends({searchParams:Promise.resolve({})}));
  const accepted = screen.getByRole("region", {name:"Your friends 0"});
  expect(within(accepted).getByRole("link", {name:"Invite a player"})).toHaveAttribute("href", "#friend-invite");
  expect(screen.getByRole("heading", {name:"Invite a player"})).toHaveAttribute("tabindex", "-1");
  expect(screen.getByRole("heading", {name:"Invite a player"})).toHaveAttribute("id", "friend-invite");
  expect(within(screen.getByRole("region", {name:"Incoming requests 0"})).getByText("New invitations appear here after you refresh.")).toBeVisible();
  mocks.friends.mockResolvedValue([{username:"Ada",rating:800,status:"pending",incoming:true}]);
  view.rerender(await Friends({searchParams:Promise.resolve({})}));
  expect(within(screen.getByRole("region", {name:"Your friends 0"})).getByRole("link", {name:"Review incoming requests"})).toHaveAttribute("href", "#friend-section-incoming");
  mocks.friends.mockResolvedValue([{username:"Ada",rating:800,status:"accepted",incoming:false}]);
  view.rerender(await Friends({searchParams:Promise.resolve({})}));
  expect(within(screen.getByRole("region", {name:"Your friends 1"})).queryByRole("link", {name:"Invite a player"})).not.toBeInTheDocument();
});
