import { fireEvent, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
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
it("joins once and shows server wait and cancellation acknowledgement", () => {
  const ws = start();
  expect(ws.url.pathname).toBe("/matchmaking");
  expect(ws.send).toHaveBeenCalledExactlyOnceWith('{"type":"join"}');
  event({ type: "queued", waitedSeconds: 12, ratingBand: 150 });
  expect(screen.getByRole("status")).toHaveTextContent("12s elapsed");
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
