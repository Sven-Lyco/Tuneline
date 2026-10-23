import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AttemptLimiter, ConnectionCounter, TokenBucket } from './limits.js';

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

describe('TokenBucket', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hands out the burst at once, then one token per interval, in order', async () => {
    const bucket = new TokenBucket(2, 3000);
    expect(await bucket.take()).toBe(0);
    expect(await bucket.take()).toBe(0);

    const order: string[] = [];
    const third = bucket.take().then((waited) => order.push(`third after ${waited}`));
    const fourth = bucket.take().then((waited) => order.push(`fourth after ${waited}`));
    await vi.advanceTimersByTimeAsync(2999);
    expect(order).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(order).toEqual(['third after 3000']);
    await vi.advanceTimersByTimeAsync(3000);
    await Promise.all([third, fourth]);
    expect(order).toEqual(['third after 3000', 'fourth after 6000']);
  });

  it('refills up to its capacity while idle', async () => {
    const bucket = new TokenBucket(2, 1000);
    await bucket.take();
    await bucket.take();
    vi.advanceTimersByTime(10_000);
    expect(await bucket.take()).toBe(0);
    expect(await bucket.take()).toBe(0);
    const third = bucket.take();
    await vi.advanceTimersByTimeAsync(1000);
    expect(await third).toBe(1000);
  });

  it('lets an aborted caller leave the queue without using a token', async () => {
    const bucket = new TokenBucket(1, 1000);
    await bucket.take();
    const abort = new AbortController();
    const leaving = bucket.take(abort.signal);
    const staying = bucket.take();
    abort.abort();
    await expect(leaving).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await staying).toBe(1000);
    await expect(bucket.take(abort.signal)).rejects.toThrow('aborted');
  });
});
