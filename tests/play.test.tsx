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
afterEach(() => { vi.unstubAllGlobals(); });
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

