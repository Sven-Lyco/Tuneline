/** Live connections per key (the client IP); a key disappears again at zero. */
export class ConnectionCounter {
  private readonly counts = new Map<string, number>();

  constructor(private readonly max: number) {}

  /** Counts one more connection for `key` — or refuses it, if `key` already has `max`. */
  tryAdd(key: string): boolean {
    const count = this.counts.get(key) ?? 0;
    if (count >= this.max) return false;
    this.counts.set(key, count + 1);
    return true;
  }

  remove(key: string): void {
    const count = (this.counts.get(key) ?? 0) - 1;
    if (count > 0) this.counts.set(key, count);
    else this.counts.delete(key);
  }

  count(key: string): number {
    return this.counts.get(key) ?? 0;
  }
}

/**
 * Failed attempts per key in a fixed window: once `max` is reached, the key stays blocked until
 * its window (which starts with its first failure) is over.
 */
export class AttemptLimiter {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  isBlocked(key: string): boolean {
    return (this.current(key)?.count ?? 0) >= this.max;
  }

  recordFailure(key: string): void {
    const entry = this.current(key);
    if (entry) entry.count++;
    else this.attempts.set(key, { count: 1, resetAt: Date.now() + this.windowMs });
    // Many different IPs (e.g. a botnet) mustn't grow this forever.
    if (this.attempts.size > 10_000) this.sweep();
  }

  private current(key: string) {
    const entry = this.attempts.get(key);
    if (entry && Date.now() >= entry.resetAt) {
      this.attempts.delete(key);
      return undefined;
    }
    return entry;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.attempts) if (now >= entry.resetAt) this.attempts.delete(key);
  }
}
