import type { Account } from "./auth";

export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];
export const MATCH_DURATION_SECONDS: Record<Difficulty, number> = { easy: 300, medium: 900, hard: 1800 };
export const difficultyFor = (rating: number): Difficulty => rating < 1200 ? "easy" : rating < 1600 ? "medium" : "hard";
export const ratingBand = (waitMs: number) => Math.min(800, 100 + Math.floor(Math.max(0, waitMs) / 10_000) * 50);
export type MatchTicket = { id: string; difficulty: Difficulty };
export type QueueEvent =
  | { type: "queued"; waitedSeconds: number; ratingBand: number }
  | { type: "left" }
  | { type: "matching" }
  | { type: "matched"; match: MatchTicket; opponent: Account }
  | { type: "error"; message: string };
export interface QueuePeer { user: Account; send(event: QueueEvent): void; connected(): boolean }
type Entry = { peer: QueuePeer; joined: number; reserved: boolean };

/** One authoritative process owns this queue. All identities/ratings come from Postgres. */
export class MatchmakingQueue {
  private entries = new Map<string, Entry>();
  private running = false;
  constructor(private createMatch: (one: Account, two: Account, difficulty: Difficulty) => Promise<MatchTicket>, private now = Date.now, private capacity = 1000, private createMatchTimeoutMs = 15_000) {}

  join(peer: QueuePeer) {
    const existing = this.entries.get(peer.user.id);
    if (existing) {
      if (existing.peer !== peer) peer.send({ type: "error", message: "Already queued in another connection." });
      else this.status(existing);
      return;
    }
    if (this.entries.size >= this.capacity) {
      peer.send({ type: "error", message: "Queue is full. Try again shortly." });
      return;
    }
    const entry = { peer, joined: this.now(), reserved: false };
    this.entries.set(peer.user.id, entry);
    this.status(entry);
  }

  leave(peer: QueuePeer) {
    const entry = this.entries.get(peer.user.id);
    if (entry?.peer === peer) {
      if (entry.reserved) { peer.send({ type: "matching" }); return; }
      this.entries.delete(peer.user.id);
    }
    peer.send({ type: "left" });
  }

  disconnect(peer: QueuePeer) {
    const entry = this.entries.get(peer.user.id);
    if (entry?.peer === peer && !entry.reserved) this.entries.delete(peer.user.id);
  }

  private status(entry: Entry) {
    const waited = Math.max(0, this.now() - entry.joined);
    entry.peer.send(entry.reserved ? { type: "matching" } : { type: "queued", waitedSeconds: Math.floor(waited / 1000), ratingBand: ratingBand(waited) });
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const entries = [...this.entries.values()];
      for (const one of entries) {
        if (this.entries.get(one.peer.user.id) !== one) continue;
        if (!one.peer.connected()) { this.entries.delete(one.peer.user.id); continue; }
        // FIFO priority; both players must accept the rating distance.
        const two = entries.find(candidate => candidate !== one && this.entries.get(candidate.peer.user.id) === candidate && candidate.peer.connected()
          && Math.abs(one.peer.user.rating - candidate.peer.user.rating) <= Math.min(ratingBand(this.now() - one.joined), ratingBand(this.now() - candidate.joined)));
        if (!two) { this.status(one); continue; }
        one.reserved = two.reserved = true;
        this.status(one); this.status(two);
        try {
          // A stalled createMatch must not block pairing every other queued player; an eventual
          // late success leaves an unnotified pending match, which the lifecycle worker auto-cancels.
          const match = await Promise.race([
            this.createMatch(one.peer.user, two.peer.user, difficultyFor((one.peer.user.rating + two.peer.user.rating) / 2)),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("createMatch timed out")), this.createMatchTimeoutMs)),
          ]);
          one.peer.send({ type: "matched", match, opponent: two.peer.user });
          two.peer.send({ type: "matched", match, opponent: one.peer.user });
        } catch {
          for (const entry of [one, two]) entry.peer.send({ type: "error", message: "Matchmaking unavailable. Please join again shortly." });
        } finally {
          this.entries.delete(one.peer.user.id); this.entries.delete(two.peer.user.id);
        }
      }
    } finally { this.running = false; }
  }
}
