// @vitest-environment node
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { afterEach, expect, it, vi } from "vitest";
import { createMatchmakingServer } from "../src/lib/matchmaking-server";
import type { QueueEvent } from "../src/lib/matchmaking";

const user = { id: "one", username: "one", rating: 800 };
const other = { id: "two", username: "two", rating: 850 };
const services: ReturnType<typeof createMatchmakingServer>[] = [];
async function setup() {
  const authenticate = vi.fn(async (token?: string) => token === "one" ? user : token === "two" ? other : null);
  const current = vi.fn(async (): Promise<null | { id: string; difficulty: "easy"; opponent: typeof user }> => null);
  const create = vi.fn(async () => ({ id: "match", difficulty: "easy" as const }));
  const service = createMatchmakingServer({ origin: "http://localhost:3000", authenticate, current, create });
  services.push(service);
  service.server.listen(0, "127.0.0.1"); await once(service.server, "listening");
  const url = `ws://127.0.0.1:${(service.server.address() as AddressInfo).port}/matchmaking`;
  const connect = (token = "one", origin = "http://localhost:3000", target = url) => new WebSocket(target, { origin, headers: { Cookie: `codeduel_session=${token}` } });
  return { authenticate, current, create, connect, url };
}
afterEach(async () => { await Promise.all(services.splice(0).map(service => service.close())); });
function receive(ws: WebSocket): Promise<QueueEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("No WebSocket event")), 4000);
    ws.once("message", data => { clearTimeout(timer); resolve(JSON.parse(data.toString())); });
  });
}
async function command(ws: WebSocket, message: unknown) {
  const response = receive(ws); ws.send(JSON.stringify(message)); return response;
}
it("rejects foreign origins, missing sessions and wrong paths before upgrade", async () => {
  const { connect, url } = await setup();
  for (const [token, origin, target, expected] of [
    ["one", "https://evil.example", url, 403], ["missing", "http://localhost:3000", url, 401], ["one", "http://localhost:3000", url + "/wrong", 403],
  ] as const) {
    const ws = connect(token, origin, target);
    const status = await new Promise<number>(resolve => { ws.on("error", () => {}); ws.once("unexpected-response", (_request, response) => { resolve(response.statusCode!); response.resume(); ws.terminate(); }); });
    expect(status).toBe(expected);
  }
});
it("queues two authenticated players and sends one persisted match", async () => {
  const { connect, create } = await setup();
  const a = connect(), b = connect("two"); await Promise.all([once(a, "open"), once(b, "open")]);
  expect((await command(a, { type: "join" })).type).toBe("queued");
  expect((await command(b, { type: "join" })).type).toBe("queued");
  const matched = (ws: WebSocket) => new Promise<QueueEvent>(resolve => ws.on("message", data => { const event = JSON.parse(data.toString()); if (event.type === "matched") resolve(event); }));
  const [one, two] = await Promise.all([matched(a), matched(b)]);
  expect(one).toEqual({ type: "matched", match: { id: "match", difficulty: "easy" }, opponent: other });
  expect(two.type).toBe("matched"); expect(create).toHaveBeenCalledOnce();
});
it("validates messages, prevents client identity spoofing, supports leave and restores a pending match", async () => {
  const { connect, current } = await setup(); const ws = connect(); await once(ws, "open");
  expect((await command(ws, { type: "join", userId: "two" })).type).toBe("error");
  expect((await command(ws, { type: "unknown" })).type).toBe("error");
  expect((await command(ws, { type: "join" })).type).toBe("queued");
  expect(await command(ws, { type: "leave" })).toEqual({ type: "left" });
  current.mockResolvedValue({ id: "existing", difficulty: "easy", opponent: other });
  expect((await command(ws, { type: "join" })).type).toBe("matched");
  expect(current).toHaveBeenLastCalledWith(user.id);
});
it("rechecks sessions before admission and closes expired sessions", async () => {
  const { connect, authenticate } = await setup(); const ws = connect(); await once(ws, "open");
  authenticate.mockResolvedValue(null);
  const closed = once(ws, "close"); ws.send(JSON.stringify({ type: "join" }));
  expect((await closed)[0]).toBe(1008);
});
it("bounds message rate", async () => {
  const { connect } = await setup(); const ws = connect(); await once(ws, "open");
  const closed = once(ws, "close");
  for (let i = 0; i < 21; i++) ws.send("{}");
  expect((await closed)[0]).toBe(1008);
});
it("preserves account command limits across reconnects without limiting another account", async () => {
  const { connect, current } = await setup();
  const first = connect(); await once(first, "open");
  for (let i = 0; i < 20; i++) await command(first, {});
  first.close(); await once(first, "close");
  const second = connect(); await once(second, "open");
  const closed = once(second, "close"); second.send('{"type":"join"}');
  expect((await closed)[0]).toBe(1008);
  expect(current).not.toHaveBeenCalled();
  const independent = connect("two"); await once(independent, "open");
  expect((await command(independent, { type: "join" })).type).toBe("queued");
});

it("limits repeated handshakes before authentication, including reconnects", async () => {
  const { connect, authenticate } = await setup();
  for (let i = 0; i < 31; i++) {
    const ws = connect("invalid");
    const status = await new Promise<number>(resolve => {
      ws.on("error", () => {});
      ws.once("unexpected-response", (_request, response) => {
        resolve(response.statusCode!); response.resume(); ws.terminate();
      });
    });
    expect(status).toBe(i < 30 ? 401 : 429);
  }
  expect(authenticate).toHaveBeenCalledTimes(30);
});
it("rejects binary commands and closes oversized frames", async () => {
  const { connect } = await setup(); const ws = connect(); await once(ws, "open");
  const response = receive(ws); ws.send(Buffer.from('{"type":"join"}'));
  expect((await response).type).toBe("error");
  const closed = once(ws, "close"); ws.send("x".repeat(1025));
  expect((await closed)[0]).toBe(1009);
});
it("hides database failures and permits a later retry", async () => {
  const { connect, current } = await setup(); const ws = connect(); await once(ws, "open");
  current.mockRejectedValueOnce(new Error("secret database details"));
  const failed = await command(ws, { type: "join" });
  expect(failed.type).toBe("error"); expect(JSON.stringify(failed)).not.toContain("secret");
  expect((await command(ws, { type: "join" })).type).toBe("queued");
});
