// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { difficultyFor, MatchmakingQueue, ratingBand, type QueueEvent, type QueuePeer } from "../src/lib/matchmaking";

function peer(id: string, rating = 800) {
  const events: QueueEvent[] = [];
  const value: QueuePeer & { events: QueueEvent[] } = { user: { id, username: id, rating }, connected: () => true, send: event => { events.push(event); }, events };
  return value;
}
const ticket = { id: "match", difficulty: "easy" as const };
describe("rating policy", () => {
  it("widens each ten seconds and caps the band", () => {
    expect([-1, 0, 9999, 10000, 140000, 999999].map(ratingBand)).toEqual([100, 100, 100, 150, 800, 800]);
    expect([800, 1199, 1200, 1599, 1600].map(difficultyFor)).toEqual(["easy", "easy", "medium", "medium", "hard"]);
  });
});
it("pairs FIFO, once, with average difficulty and only public opponent data", async () => {
  const create = vi.fn(async () => ticket);
  const queue = new MatchmakingQueue(create);
  const a = peer("a", 1200), b = peer("b", 1250), c = peer("c", 1250);
  queue.join(a); queue.join(b); queue.join(c);
  await queue.tick(); await queue.tick();
  expect(create).toHaveBeenCalledExactlyOnceWith(a.user, b.user, "medium");
  expect(a.events.at(-1)).toEqual({ type: "matched", match: ticket, opponent: b.user });
  expect(c.events.at(-1)?.type).toBe("queued");
});
it("requires both rating bands to widen and preserves wait on repeated joins", async () => {
  let now = 0;
  const create = vi.fn(async () => ticket);
  const queue = new MatchmakingQueue(create, () => now);
  const a = peer("a"), b = peer("b", 1000);
  queue.join(a); now = 20000; queue.join(a); queue.join(b);
  await queue.tick(); expect(create).not.toHaveBeenCalled();
  now = 40000; await queue.tick(); expect(create).toHaveBeenCalledOnce();
});
it("rejects duplicate tabs, handles leave/disconnect, and bounds capacity", async () => {
  const create = vi.fn(async () => ticket);
  const queue = new MatchmakingQueue(create, Date.now, 1);
  const a = peer("a"), duplicate = peer("a"), b = peer("b");
  queue.join(a); queue.join(duplicate); queue.disconnect(duplicate); queue.join(b);
  expect(duplicate.events.at(-1)?.type).toBe("error");
  expect(b.events.at(-1)?.type).toBe("error");
  queue.leave(a); expect(a.events.at(-1)?.type).toBe("left");
  queue.join(b); queue.disconnect(b); queue.join(a);
  expect(a.events.at(-1)?.type).toBe("queued");
  a.connected = () => false; await queue.tick(); queue.join(b);
  expect(b.events.at(-1)?.type).toBe("queued");
});
it("reserves during async persistence and ignores overlapping ticks", async () => {
  let finish!: (value: typeof ticket) => void;
  const create = vi.fn(() => new Promise<typeof ticket>(resolve => { finish = resolve; }));
  const queue = new MatchmakingQueue(create);
  const a = peer("a"), b = peer("b"); queue.join(a); queue.join(b);
  const tick = queue.tick(); queue.leave(a); queue.disconnect(a); await queue.tick();
  expect(a.events.at(-1)?.type).toBe("matching");
  finish(ticket); await tick; await queue.tick();
  expect(create).toHaveBeenCalledOnce();
  expect(a.events.at(-1)?.type).toBe("matched");
});
it("fails closed and permits explicit retry after persistence failure", async () => {
  const create = vi.fn().mockRejectedValueOnce(new Error("private database details")).mockResolvedValue(ticket);
  const queue = new MatchmakingQueue(create);
  const a = peer("a"), b = peer("b"); queue.join(a); queue.join(b); await queue.tick();
  expect(a.events.at(-1)?.type).toBe("error"); expect(JSON.stringify(a.events)).not.toContain("private");
  await queue.tick(); expect(create).toHaveBeenCalledOnce();
  queue.join(a); queue.join(b); await queue.tick(); expect(create).toHaveBeenCalledTimes(2);
});
