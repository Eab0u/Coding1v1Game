import { fireEvent, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Link from "next/link";
import { Play } from "../src/components/play";
class Socket {
  static OPEN = 1;
  static latest: Socket;
  readyState = 1;
  send = vi.fn(); close = vi.fn();
  onopen = () => {}; onclose = () => {}; onerror = () => {};
  onmessage = (event: { data: string }) => { void event; };
  constructor(public url: URL) { Socket.latest = this; }
}
beforeEach(() => { vi.stubGlobal("WebSocket", Socket); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function start() { render(<Play signedIn />); fireEvent.click(screen.getByRole("button", { name: "Play a duel" })); act(() => Socket.latest.onopen()); return Socket.latest; }
function event(data: object) { act(() => Socket.latest.onmessage({ data: JSON.stringify(data) })); }
it("recovers from a browser connection setup failure and permits a successful retry", () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", class { constructor() { throw new DOMException("Blocked", "SecurityError"); } });
  render(<Play signedIn />);
  const play = screen.getByRole("button", { name: "Play a duel" });
  play.focus();
  fireEvent.click(play);
  expect(play).toBeEnabled();
  expect(play).toHaveAttribute("aria-busy", "false");
  expect(play).toHaveFocus();
  expect(screen.getByRole("status")).toHaveTextContent("Could not open a matchmaking connection. Please try again.");
  expect(screen.queryByRole("button", { name: "Cancel search" })).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(10000));
  expect(screen.getByRole("status")).toHaveTextContent("Could not open a matchmaking connection");
  vi.stubGlobal("WebSocket", Socket);
  fireEvent.click(play);
  act(() => Socket.latest.onopen());
  expect(Socket.latest.send).toHaveBeenCalledExactlyOnceWith('{"type":"join"}');
  event({ type: "queued", waitedSeconds: 0, ratingBand: 100 });
  event({ type: "matched", match: { id: "retry", difficulty: "easy" }, opponent: { username: "Ada", rating: 800 } });
  expect(screen.getByRole("link", { name: "Open arena" })).toHaveFocus();
});
it.each(["confirmed", "timeout", "disconnect", "error", "connecting"])("restores Play focus after focused cancellation ends through %s", outcome => {
  vi.useFakeTimers();
  start();
  if (outcome === "connecting") Socket.latest.readyState = 0;
  else event({ type: "queued", waitedSeconds: 0, ratingBand: 100 });
  const cancel = screen.getByRole("button", { name: "Cancel search" });
  cancel.focus();
  fireEvent.click(cancel);
  if (outcome === "confirmed") event({ type: "left" });
  if (outcome === "timeout") act(() => vi.advanceTimersByTime(10000));
  if (outcome === "disconnect") act(() => Socket.latest.onclose());
  if (outcome === "error") event({ type: "error", message: "Please retry" });
  expect(screen.getByRole("button", { name: "Play a duel" })).toHaveFocus();
});

it("preserves independent navigation during cancellation and clears focus intent before retry", () => {
  render(<><Link href="/profile/Ada">View profile</Link><Play signedIn /></>);
  fireEvent.click(screen.getByRole("button", { name: "Play a duel" }));
  act(() => Socket.latest.onopen());
  const cancel = screen.getByRole("button", { name: "Cancel search" });
  cancel.focus(); fireEvent.click(cancel);
  const profile = screen.getByRole("link", { name: "View profile" });
  profile.focus();
  event({ type: "left" });
  expect(profile).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Play a duel" }));
  act(() => Socket.latest.onerror());
  expect(profile).toHaveFocus();
});

it("does not move focus for an unfocused cancellation", () => {
  start();
  fireEvent.click(screen.getByRole("button", { name: "Cancel search" }));
  event({ type: "left" });
  expect(screen.getByRole("button", { name: "Play a duel" })).not.toHaveFocus();
});

it("hands cancellation races to the arena without restoring Play focus", () => {
  start();
  const cancel = screen.getByRole("button", { name: "Cancel search" });
  cancel.focus(); fireEvent.click(cancel);
  event({ type: "matched", match: { id: "race", difficulty: "easy" }, opponent: { username: "Ada", rating: 800 } });
  expect(screen.getByRole("link", { name: "Open arena" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Match reserved" })).not.toHaveFocus();
});
it("joins once and shows server wait and cancellation acknowledgement", () => {
  const ws = start();
  expect(ws.url.pathname).toBe("/matchmaking");
  expect(ws.send).toHaveBeenCalledExactlyOnceWith('{"type":"join"}');
  event({ type: "queued", waitedSeconds: 12, ratingBand: 150 });
  expect(screen.getByText("12s elapsed")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel search" }));
  expect(ws.send).toHaveBeenLastCalledWith('{"type":"leave"}');
  event({ type: "left" });
  expect(screen.getByRole("button", { name: "Play a duel" })).toBeEnabled();
});
it("keeps a reserved match visible after socket closure", () => {
  const ws = start();
  event({ type: "matched", match: { id: "m", difficulty: "easy" }, opponent: { username: "Ada", rating: 800 } });
  act(() => ws.onclose());
  expect(screen.getByRole("status")).toHaveTextContent("Matched with Ada");
  expect(screen.getByText("Match found")).toHaveClass("duel-cue--matched");
  // A duplicate frame on the closed connection must not replay feedback.
  const cue = screen.getByText("Match found");
  event({ type: "matched", match: { id: "m", difficulty: "easy" }, opponent: { username: "Ada", rating: 800 } });
  expect(screen.getByText("Match found")).toBe(cue);
  expect(screen.getByRole("button", { name: "Match reserved" })).toBeDisabled();
  expect(screen.getByRole("link", { name: "Open arena" })).toHaveAttribute("href", "/match/m");
});
it("permits retry after disconnect and ignores stale connection messages", () => {
  const ws = start(); act(() => ws.onerror());
  fireEvent.click(screen.getByRole("button", { name: "Play a duel" }));
  act(() => ws.onmessage({ data: '{"type":"error","message":"stale"}' }));
  expect(screen.getByRole("status")).toHaveTextContent("Connecting");
});
it("closes an outstanding search on unmount", () => {
  const view = render(<Play signedIn />);
  fireEvent.click(screen.getByRole("button", { name: "Play a duel" }));
  view.unmount(); expect(Socket.latest.close).toHaveBeenCalled();
});


it("times out an open connection without a join acknowledgement and permits retry", () => {
  vi.useFakeTimers();
  const ws = start();
  act(() => vi.advanceTimersByTime(10000));
  expect(ws.close).toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent("did not confirm your search");
  fireEvent.click(screen.getByRole("button", { name: "Play a duel" }));
  act(() => ws.onmessage({ data: '{"type":"queued","waitedSeconds":0,"ratingBand":100}' }));
  expect(screen.getByRole("status")).toHaveTextContent("Connecting");
});
it("waits for cancellation despite queued frames and recovers if acknowledgement never arrives", () => {
  vi.useFakeTimers();
  start();
  event({ type: "queued", waitedSeconds: 0, ratingBand: 100 });
  fireEvent.click(screen.getByRole("button", { name: "Cancel search" }));
  event({ type: "queued", waitedSeconds: 1, ratingBand: 100 });
  expect(screen.queryByRole("button", { name: "Cancel search" })).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(10000));
  expect(screen.getByRole("status")).toHaveTextContent("Cancellation was not confirmed");
  expect(screen.getByRole("button", { name: "Play a duel" })).toBeEnabled();
});
it("clears acknowledgement timers on success and unmount", () => {
  vi.useFakeTimers();
  const view = render(<Play signedIn />);
  fireEvent.click(screen.getByRole("button", { name: "Play a duel" }));
  act(() => Socket.latest.onopen());
  event({ type: "queued", waitedSeconds: 0, ratingBand: 100 });
  act(() => vi.advanceTimersByTime(10000));
  expect(screen.getByRole("status")).toHaveTextContent("Finding opponent");
  fireEvent.click(screen.getByRole("button", { name: "Cancel search" }));
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it("preserves a reservation received while cancelling", () => {
  vi.useFakeTimers();
  start();
  event({ type: "queued", waitedSeconds: 0, ratingBand: 100 });
  fireEvent.click(screen.getByRole("button", { name: "Cancel search" }));
  event({ type: "matched", match: { id: "race", difficulty: "easy" }, opponent: { username: "Ada", rating: 800 } });
  act(() => vi.advanceTimersByTime(10000));
  expect(screen.getByRole("link", { name: "Open arena" })).toHaveAttribute("href", "/match/race");
});

it("recovers from a synchronous command send failure", () => {
  vi.useFakeTimers();
  render(<Play signedIn />);
  fireEvent.click(screen.getByRole("button", { name: "Play a duel" }));
  Socket.latest.send.mockImplementationOnce(() => { throw new Error("closed"); });
  act(() => Socket.latest.onopen());
  expect(screen.getByRole("button", { name: "Play a duel" })).toBeEnabled();
  expect(screen.getByRole("status")).toHaveTextContent("Connection lost");
  expect(vi.getTimerCount()).toBe(0);
});

it("bounds reservation confirmation, ignores repeated frames and recovers the ticket on retry", () => {
  vi.useFakeTimers();
  const ws = start();
  event({ type: "matching" });
  expect(screen.getByRole("button", { name: "Reserving match…" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("Waiting for server confirmation");
  act(() => vi.advanceTimersByTime(9000));
  event({ type: "matching" });
  event({ type: "queued", waitedSeconds: 9, ratingBand: 100 });
  expect(screen.queryByRole("button", { name: "Cancel search" })).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1000));
  expect(ws.close).toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent("reservation was not confirmed");
  fireEvent.click(screen.getByRole("button", { name: "Play a duel" }));
  act(() => Socket.latest.onopen());
  act(() => ws.onmessage({ data: JSON.stringify({ type: "matched", match: { id: "stale" }, opponent: { username: "Old", rating: 800 } }) }));
  expect(screen.queryByRole("link", { name: "Open arena" })).not.toBeInTheDocument();
  event({ type: "matched", match: { id: "recovered", difficulty: "easy" }, opponent: { username: "Ada", rating: 800 } });
  expect(screen.getByRole("link", { name: "Open arena" })).toHaveAttribute("href", "/match/recovered");
  act(() => vi.advanceTimersByTime(10000));
  expect(vi.getTimerCount()).toBe(0);
});

it("clears the reservation deadline after confirmation and on unmount", () => {
  vi.useFakeTimers();
  const view = render(<Play signedIn />);
  fireEvent.click(screen.getByRole("button", { name: "Play a duel" }));
  act(() => Socket.latest.onopen());
  event({ type: "matching" });
  event({ type: "matched", match: { id: "m", difficulty: "easy" }, opponent: { username: "Ada", rating: 800 } });
  act(() => vi.advanceTimersByTime(10000));
  expect(screen.getByRole("link", { name: "Open arena" })).toBeInTheDocument();
  view.unmount();
  const pending = render(<Play signedIn />);
  fireEvent.click(screen.getByRole("button", { name: "Play a duel" }));
  act(() => Socket.latest.onopen());
  event({ type: "matching" });
  pending.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("updates visible queue metrics without changing the live announcement and clears them on cancellation", () => {
  start();
  event({ type: "queued", waitedSeconds: 12, ratingBand: 150 });
  const status = screen.getByRole("status");
  const announcement = status.textContent;
  expect(screen.getByLabelText("Current search details")).toHaveAttribute("aria-live", "off");
  event({ type: "queued", waitedSeconds: 20, ratingBand: 200 });
  expect(status.textContent).toBe(announcement);
  expect(screen.getByText("20s elapsed")).toBeInTheDocument();
  expect(screen.getByText("±200 points")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel search" }));
  expect(screen.queryByLabelText("Current search details")).not.toBeInTheDocument();
  expect(status).toHaveTextContent("Waiting for server confirmation");
});

it("hides queue metrics when reserving", () => {
  start();
  event({ type: "queued", waitedSeconds: 1, ratingBand: 100 });
  event({ type: "matching" });
  expect(screen.queryByLabelText("Current search details")).not.toBeInTheDocument();
});

it("recovers from invalid queue metrics without rendering them", () => {
  start();
  event({ type: "queued", waitedSeconds: -1, ratingBand: 100 });
  expect(screen.queryByLabelText("Current search details")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Unexpected server response");
  expect(screen.getByRole("button", { name: "Play a duel" })).toBeEnabled();
});


it("renders readable matchmaking copy throughout connection, search, cancellation and reservation", () => {
  render(<Play signedIn />);
  expect(screen.getByRole("status")).toHaveTextContent("Python only · Rating bands widen as you wait.");
  fireEvent.click(screen.getByRole("button", { name: "Play a duel" }));
  expect(screen.getByRole("button", { name: "Connecting…" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("Connecting to the arena…");
  act(() => Socket.latest.onopen());
  event({ type: "queued", waitedSeconds: 0, ratingBand: 100 });
  expect(screen.getByRole("button", { name: "Finding opponent…" })).toBeDisabled();
  expect(screen.getByText("±100 points")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel search" }));
  expect(screen.getByRole("button", { name: "Cancelling search…" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("Cancelling your search… Waiting for server confirmation.");
  event({ type: "left" });
  fireEvent.click(screen.getByRole("button", { name: "Play a duel" }));
  act(() => Socket.latest.onopen());
  event({ type: "matching" });
  expect(screen.getByRole("button", { name: "Reserving match…" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("Reserving your match… Waiting for server confirmation.");
  event({ type: "matched", match: { id: "m", difficulty: "easy" }, opponent: { username: "Ada", rating: 800 } });
  expect(screen.getByRole("status")).toHaveTextContent("Matched with Ada (800) · easy.");
});


it.each(["play", "cancel"])("focuses the arena link when a match replaces the focused %s search control", control => {
  render(<Play signedIn />);
  const play = screen.getByRole("button", { name: "Play a duel" });
  play.focus();
  fireEvent.click(play);
  act(() => Socket.latest.onopen());
  event({ type: "queued", waitedSeconds: 0, ratingBand: 100 });
  if (control === "cancel") screen.getByRole("button", { name: "Cancel search" }).focus();
  event({ type: "matched", match: { id: "keyboard", difficulty: "easy" }, opponent: { username: "Ada", rating: 800 } });
  expect(screen.getByRole("link", { name: "Open arena" })).toHaveFocus();
});

it("preserves independent navigation through queue updates, reservation and duplicate match frames", () => {
  render(<><Link href="/profile/Ada">View profile</Link><Play signedIn /></>);
  fireEvent.click(screen.getByRole("button", { name: "Play a duel" }));
  act(() => Socket.latest.onopen());
  const profile = screen.getByRole("link", { name: "View profile" });
  profile.focus();
  event({ type: "queued", waitedSeconds: 5, ratingBand: 100 });
  event({ type: "matching" });
  event({ type: "matched", match: { id: "background", difficulty: "easy" }, opponent: { username: "Ada", rating: 800 } });
  expect(profile).toHaveFocus();
  event({ type: "matched", match: { id: "background", difficulty: "easy" }, opponent: { username: "Ada", rating: 800 } });
  expect(profile).toHaveFocus();
});


it("does not transfer focus after a failed search or from an obsolete connection", () => {
  const ws = start();
  event({ type: "error", message: "Please retry" });
  const play = screen.getByRole("button", { name: "Play a duel" });
  play.focus();
  expect(play).toHaveFocus();
  expect(screen.queryByRole("link", { name: "Open arena" })).not.toBeInTheDocument();
  fireEvent.click(play);
  act(() => ws.onmessage({ data: JSON.stringify({ type: "matched", match: { id: "old", difficulty: "easy" }, opponent: { username: "Ada", rating: 800 } }) }));
  expect(play).toHaveFocus();
  expect(screen.queryByRole("link", { name: "Open arena" })).not.toBeInTheDocument();
  act(() => Socket.latest.onopen());
  event({ type: "matching" });
  event({ type: "matched", match: { id: "retry", difficulty: "easy" }, opponent: { username: "Ada", rating: 800 } });
  expect(screen.getByRole("link", { name: "Open arena" })).toHaveFocus();
});
it("connects matchmaking controls to stable guidance throughout the search lifecycle", () => {
  start();
  const status = screen.getByRole("status");
  const id = status.id;
  const play = screen.getByRole("button", { name: "Connecting…" });
  expect(id).toBeTruthy();
  expect(play).toHaveAttribute("aria-describedby", id);
  expect(play).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("button", { name: "Cancel search" })).toHaveAttribute("aria-describedby", id);
  event({ type: "queued", waitedSeconds: 0, ratingBand: 100 });
  expect(play).toHaveAttribute("aria-busy", "false");
  fireEvent.click(screen.getByRole("button", { name: "Cancel search" }));
  expect(play).toHaveAttribute("aria-busy", "true");
  event({ type: "left" });
  expect(play).toHaveAttribute("aria-busy", "false");
  expect(screen.getByRole("status")).toBe(status);
  expect(play).toHaveAccessibleDescription("Search cancelled. Ready when you are.");
  fireEvent.click(play);
  act(() => Socket.latest.onopen());
  event({ type: "matching" });
  expect(play).toHaveAttribute("aria-busy", "true");
  event({ type: "matched", match: { id: "accessible", difficulty: "easy" }, opponent: { username: "Ada", rating: 800 } });
  expect(play).toHaveAttribute("aria-busy", "false");
  expect(screen.getByRole("link", { name: "Open arena" })).toHaveAttribute("aria-describedby", id);
  expect(screen.getByRole("status")).toBe(status);
});

it.each(["timeout", "error", "disconnect"])("clears pending matchmaking busy feedback after %s", outcome => {
  vi.useFakeTimers();
  start();
  if (outcome === "timeout") act(() => vi.advanceTimersByTime(10000));
  if (outcome === "error") event({ type: "error", message: "Please retry" });
  if (outcome === "disconnect") act(() => Socket.latest.onclose());
  const play = screen.getByRole("button", { name: "Play a duel" });
  expect(play).toHaveAttribute("aria-busy", "false");
  expect(play).toHaveAccessibleDescription(screen.getByRole("status").textContent!);
});

it("keeps guidance associations unique across matchmaking panels", () => {
  render(<><Play signedIn /><Play signedIn /></>);
  const buttons = screen.getAllByRole("button", { name: "Play a duel" });
  const statuses = screen.getAllByRole("status");
  expect(statuses[0].id).not.toBe(statuses[1].id);
  buttons.forEach((button, index) => expect(button).toHaveAttribute("aria-describedby", statuses[index].id));
});


it.each(["disconnect", "error", "server error", "malformed", "timeout"])("restores Play after %s removes the focused search control", outcome => {
  vi.useFakeTimers();
  start();
  const cancel = screen.getByRole("button", { name: "Cancel search" });
  cancel.focus();
  if (outcome === "disconnect") act(() => Socket.latest.onclose());
  if (outcome === "error") act(() => Socket.latest.onerror());
  if (outcome === "server error") event({ type: "error", message: "Search unavailable" });
  if (outcome === "malformed") event({ type: "queued", waitedSeconds: -1, ratingBand: 100 });
  if (outcome === "timeout") act(() => vi.advanceTimersByTime(10000));
  expect(screen.getByRole("button", { name: "Play a duel" })).toHaveFocus();
  expect(cancel).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Play a duel" }));
  act(() => Socket.latest.onopen());
  event({ type: "queued", waitedSeconds: 0, ratingBand: 100 });
  event({ type: "matched", match: { id: "recovered", difficulty: "easy" }, opponent: { username: "Ada", rating: 800 } });
  expect(screen.getByRole("link", { name: "Open arena" })).toHaveFocus();
});

it("preserves navigation away from Cancel when the search fails", () => {
  render(<><Link href="/profile/Ada">View profile</Link><Play signedIn /></>);
  fireEvent.click(screen.getByRole("button", { name: "Play a duel" }));
  act(() => Socket.latest.onopen());
  screen.getByRole("button", { name: "Cancel search" }).focus();
  const profile = screen.getByRole("link", { name: "View profile" });
  profile.focus();
  act(() => Socket.latest.onerror());
  expect(profile).toHaveFocus();
});


it("restores Play when an established queued search disconnects and ignores its late frames", () => {
  const ws = start();
  event({ type: "queued", waitedSeconds: 12, ratingBand: 150 });
  screen.getByRole("button", { name: "Cancel search" }).focus();
  act(() => ws.onclose());
  const play = screen.getByRole("button", { name: "Play a duel" });
  expect(play).toHaveFocus();
  fireEvent.click(play);
  act(() => Socket.latest.onopen());
  const cancel = screen.getByRole("button", { name: "Cancel search" });
  cancel.focus();
  act(() => ws.onerror());
  act(() => ws.onmessage({ data: JSON.stringify({ type: "error", message: "Obsolete failure" }) }));
  expect(cancel).toHaveFocus();
  expect(screen.getByRole("status")).toHaveTextContent("Connecting");
});

it.each([
  { match: null },
  { match: { id: '', difficulty: 'easy' } },
  { match: { id: '../account?redirect=1', difficulty: 'easy' } },
  { match: { id: 'x'.repeat(129), difficulty: 'easy' } },
  { match: { id: 12, difficulty: 'easy' } },
  { match: { id: 'match', difficulty: 'unknown' } },
  { opponent: null },
  { opponent: { username: ' ', rating: 800 } },
  { opponent: { username: 'Ada', rating: '800' } },
  { opponent: { username: 'Ada', rating: -1 } },
  { opponent: { username: 'Ada', rating: null } },
])('rejects malformed match confirmation %j and recovers through a valid retry', invalid => {
  vi.useFakeTimers();
  const ws = start();
  event({ type: 'queued', waitedSeconds: 0, ratingBand: 100 });
  screen.getByRole('button', { name: 'Cancel search' }).focus();
  event({ type: 'matched', match: { id: 'valid', difficulty: 'easy' }, opponent: { username: 'Ada', rating: 800 }, ...invalid });
  expect(screen.queryByRole('link', { name: 'Open arena' })).not.toBeInTheDocument();
  const play = screen.getByRole('button', { name: 'Play a duel' });
  expect(play).toBeEnabled();
  expect(play).toHaveFocus();
  expect(play).toHaveAttribute('aria-busy', 'false');
  expect(screen.getByRole('status')).toHaveTextContent('Unexpected server response. Please try again.');
  expect(ws.close).toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(10000));
  expect(screen.getByRole('status')).toHaveTextContent('Unexpected server response. Please try again.');
  fireEvent.click(play);
  act(() => Socket.latest.onopen());
  event({ type: 'matched', match: { id: 'recovered', difficulty: 'hard' }, opponent: { username: 'Ada', rating: 1600 } });
  expect(screen.getByRole('link', { name: 'Open arena' })).toHaveAttribute('href', '/match/recovered');
  expect(screen.getByRole('link', { name: 'Open arena' })).toHaveFocus();
});

it.each([null, [], {}, { type: "unknown" }, { type: 1 },
  { type: "error" }, { type: "error", message: {} },
  { type: "error", message: "   " }])("recovers from malformed response %j and permits retry", frame => {
  vi.useFakeTimers();
  const ws = start();
  event({ type: "queued", waitedSeconds: 0, ratingBand: 100 });
  screen.getByRole("button", { name: "Cancel search" }).focus();
  act(() => ws.onmessage({ data: JSON.stringify(frame) }));
  const play = screen.getByRole("button", { name: "Play a duel" });
  expect(play).toBeEnabled();
  expect(play).toHaveFocus();
  expect(play).toHaveAttribute("aria-busy", "false");
  expect(ws.close).toHaveBeenCalledOnce();
  expect(screen.getByRole("status")).toHaveTextContent("Unexpected server response. Please try again.");
  expect(screen.queryByRole("button", { name: "Cancel search" })).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(10000));
  expect(screen.getByRole("status")).toHaveTextContent("Unexpected server response");
  fireEvent.click(play);
  act(() => Socket.latest.onopen());
  event({ type: "queued", waitedSeconds: 0, ratingBand: 100 });
  event({ type: "matched", match: { id: "retry", difficulty: "easy" }, opponent: { username: "Ada", rating: 800 } });
  expect(screen.getByRole("link", { name: "Open arena" })).toHaveFocus();
});
