// Fixed windows shared across connections. Refuse new keys at capacity rather
// than evicting live counters and allowing a flood to reset other users' limits.
export class RateLimit {
  private readonly windows = new Map<string, { start: number; count: number }>();
  constructor(private readonly limit: number, private readonly duration: number, private readonly capacity = 10_000) {}

  allow(key: string, now = Date.now()): boolean {
    for (const [id, window] of this.windows) {
      if (now - window.start >= this.duration) this.windows.delete(id);
    }
    let window = this.windows.get(key);
    if (!window) {
      if (this.windows.size >= this.capacity) return false;
      window = { start: now, count: 0 };
      this.windows.set(key, window);
    }
    if (window.count >= this.limit) return false;
    window.count++;
    return true;
  }
}
