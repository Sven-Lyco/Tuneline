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

/**
 * A shared request budget: up to `capacity` at once, then one more every `refillMs`. Callers wait
 * in order for a token; one whose signal aborts leaves the queue.
 */
export class TokenBucket {
  private tokens: number;
  private refilledAt = Date.now();
  private readonly waiting: Array<{ since: number; grant: () => void; abort: () => void }> = [];
  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly capacity: number,
    private readonly refillMs: number,
  ) {
    this.tokens = capacity;
  }

  /** Resolves with how long the caller waited (ms); rejects if `signal` aborts first. */
  take(signal?: AbortSignal): Promise<number> {
    if (signal?.aborted) return Promise.reject(new Error('aborted'));
    this.refill();
    if (this.waiting.length === 0 && this.tokens >= 1) {
      this.tokens--;
      return Promise.resolve(0);
    }
    return new Promise((resolve, reject) => {
      const since = Date.now();
      const entry = {
        since,
        grant: () => {
          signal?.removeEventListener('abort', entry.abort);
          resolve(Date.now() - since);
        },
        abort: () => {
          const i = this.waiting.indexOf(entry);
          if (i >= 0) this.waiting.splice(i, 1);
          reject(new Error('aborted'));
        },
      };
      signal?.addEventListener('abort', entry.abort, { once: true });
      this.waiting.push(entry);
      this.schedule();
    });
  }

  private refill(): void {
    const now = Date.now();
    if (this.tokens >= this.capacity) {
      this.refilledAt = now;
      return;
    }
    const gained = Math.floor((now - this.refilledAt) / this.refillMs);
    if (gained > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + gained);
      this.refilledAt += gained * this.refillMs;
    }
  }

  private schedule(): void {
    if (this.timer || this.waiting.length === 0) return;
    const wait = Math.max(0, this.refilledAt + this.refillMs - Date.now());
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.refill();
      while (this.waiting.length > 0 && this.tokens >= 1) {
        this.tokens--;
        this.waiting.shift()!.grant();
      }
      this.schedule();
    }, wait);
  }
}
