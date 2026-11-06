import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { SESSION_COOKIE, type Account } from "./auth";
import { RateLimit } from "./rate-limit";
import { MatchmakingQueue, type QueuePeer, type MatchTicket, type Difficulty } from "./matchmaking";

type Dependencies = {
  origin: string;
  authenticate(token?: string): Promise<Account | null>;
  current(userId: string): Promise<(MatchTicket & { opponent: Account }) | null>;
  create(one: Account, two: Account, difficulty: Difficulty): Promise<MatchTicket>;
};

export function createMatchmakingServer(deps: Dependencies) {
  const server = createServer((_req, res) => { res.writeHead(404); res.end(); });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 1024, perMessageDeflate: false });
  const queue = new MatchmakingQueue(deps.create);
  let upgrades = 0;
  const connections = new RateLimit(30, 60_000);
  const commands = new RateLimit(20, 10_000);
  server.on("upgrade", async (request, socket, head) => {
    const reject = (status: number) => { socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\n\r\n`); };
    if (request.url !== "/matchmaking" || request.headers.origin !== deps.origin) { reject(403); return; }
    // Use the actual peer address, never a spoofable forwarded header.
    if (!connections.allow(request.socket.remoteAddress ?? "unknown")) { reject(429); return; }
    if (sockets.clients.size + upgrades >= 1000) { reject(503); return; }
    upgrades++;
    const timeout = setTimeout(() => socket.destroy(), 10_000);
    try {
      const token = request.headers.cookie?.split(";").map(value => value.trim()).find(value => value.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
      const user = await deps.authenticate(token);
      if (!user) { reject(401); return; }
      if (socket.destroyed) return;
      clearTimeout(timeout);
      sockets.handleUpgrade(request, socket, head, ws => {
        let alive = true;
        let processing = false;
        const peer: QueuePeer = {
          user,
          connected: () => ws.readyState === WebSocket.OPEN,
          send: event => {
            if (ws.readyState !== WebSocket.OPEN) return;
            if (ws.bufferedAmount > 64 * 1024) { ws.terminate(); return; }
            ws.send(JSON.stringify(event));
          },
        };
        ws.on("error", () => ws.terminate());
        ws.on("close", () => queue.disconnect(peer));
        ws.on("pong", () => { alive = true; });
        const heartbeat = setInterval(() => {
          if (!alive) { ws.terminate(); return; }
          alive = false; ws.ping();
          void deps.authenticate(token).then(account => { if (!account) ws.close(1008, "Session expired"); }).catch(() => ws.close(1011, "Authentication unavailable"));
        }, 30_000);
        ws.once("close", () => clearInterval(heartbeat));
        ws.on("message", async (data, binary) => {
          if (!commands.allow(user.id)) { ws.close(1008, "Too many requests"); return; }
          if (processing) return;
          let type: unknown;
          try {
            if (binary) throw new Error();
            const message = JSON.parse(data.toString());
            if (!message || typeof message !== "object" || Object.keys(message).length !== 1) throw new Error();
            type = message.type;
            if (type !== "join" && type !== "leave") throw new Error();
          } catch { peer.send({ type: "error", message: "Send {type: join} or {type: leave} as JSON." }); return; }
          if (type === "leave") { queue.leave(peer); return; }
          processing = true;
          try {
            const account = await deps.authenticate(token);
            if (!account) { ws.close(1008, "Session expired"); return; }
            peer.user = account;
            const match = await deps.current(account.id);
            if (!peer.connected()) return;
            if (match) peer.send({ type: "matched", match: { id: match.id, difficulty: match.difficulty }, opponent: match.opponent });
            else queue.join(peer);
          } catch { peer.send({ type: "error", message: "Matchmaking unavailable. Try again shortly." }); }
          finally { processing = false; }
        });
        sockets.emit("connection", ws, request);
      });
    } catch { reject(503); }
    finally { clearTimeout(timeout); upgrades--; }
  });
  const timer = setInterval(() => { void queue.tick(); }, 1000);
  return {
    server,
    async close() {
      clearInterval(timer);
      for (const ws of sockets.clients) ws.terminate();
      await new Promise<void>(resolve => sockets.close(() => resolve()));
      if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}
