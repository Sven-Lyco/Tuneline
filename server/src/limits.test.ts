import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AttemptLimiter, ConnectionCounter } from './limits.js';

describe('ConnectionCounter', () => {
  it('counts per key up to the limit and forgets keys at zero', () => {
    const counter = new ConnectionCounter(2);
    expect(counter.tryAdd('a')).toBe(true);
    expect(counter.tryAdd('a')).toBe(true);
    expect(counter.tryAdd('a')).toBe(false);
    expect(counter.tryAdd('b')).toBe(true);

    counter.remove('a');
    expect(counter.count('a')).toBe(1);
    expect(counter.tryAdd('a')).toBe(true);
    counter.remove('b');
    counter.remove('b'); // more removes than adds never go negative
    expect(counter.count('b')).toBe(0);
    expect(counter.tryAdd('b')).toBe(true);
  });
});

describe('AttemptLimiter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('blocks a key after max failures until its window is over', () => {
    const limiter = new AttemptLimiter(3, 60_000);
    limiter.recordFailure('ip');
    limiter.recordFailure('ip');
    expect(limiter.isBlocked('ip')).toBe(false);
    limiter.recordFailure('ip');
    expect(limiter.isBlocked('ip')).toBe(true);
    expect(limiter.isBlocked('other')).toBe(false);

    vi.advanceTimersByTime(60_000);
    expect(limiter.isBlocked('ip')).toBe(false);
    limiter.recordFailure('ip');
    expect(limiter.isBlocked('ip')).toBe(false);
  });

  it('sweeps expired keys once it tracks many', () => {
    const limiter = new AttemptLimiter(1, 1_000);
    for (let i = 0; i <= 10_000; i++) limiter.recordFailure(`old-${i}`);
    vi.advanceTimersByTime(1_000);
    limiter.recordFailure('new'); // above 10 000 keys: the expired ones go
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((limiter as any).attempts.size).toBe(1);
    expect(limiter.isBlocked('new')).toBe(true);
  });
});
