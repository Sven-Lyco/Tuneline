import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

type AuthModule = typeof import('./auth.js');
let auth: AuthModule;

const data = (token: string) => ({ accessToken: token, refreshToken: 'r', expiresAt: 0 });

beforeAll(async () => {
  // The sweep interval starts on import, so a fresh module under fake timers is needed.
  vi.useFakeTimers();
  vi.resetModules();
  auth = await import('./auth.js');
});

afterAll(() => {
  vi.useRealTimers();
});

describe('sessions', () => {
  it('forgets the cached Spotify data of a deleted or expired session', async () => {
    const cache = await import('./playlistCache.js');
    const listed = [{ id: 'p1', snapshotId: 'v1', followed: false }];
    const deleted = auth.createSession(data('d'));
    cache.rememberPlaylists(deleted, listed);
    auth.deleteSession(deleted);
    expect(cache.listedPlaylist(deleted, 'p1')).toBeUndefined();

    const expiring = auth.createSession(data('e'));
    cache.rememberPlaylists(expiring, listed);
    vi.advanceTimersByTime(auth.SESSION_MAX_AGE_MS + 1);
    expect(auth.getSession(expiring)).toBeNull();
    expect(cache.listedPlaylist(expiring, 'p1')).toBeUndefined();
  });

  it('creates random ids and stores session data', () => {
    const a = auth.createSession(data('a'));
    const b = auth.createSession(data('b'));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(auth.getSession(a)).toEqual(data('a'));
    expect(auth.getSession('unknown')).toBeNull();
  });

  it('updates existing sessions but never brings deleted ones back', () => {
    const id = auth.createSession(data('old'));
    auth.updateSession(id, data('new'));
    expect(auth.getSession(id)).toEqual(data('new'));

    auth.deleteSession(id);
    auth.updateSession(id, data('zombie'));
    expect(auth.getSession(id)).toBeNull();
  });

  it('expires after seven days, on read and via the hourly sweep', () => {
    const read = auth.createSession(data('read'));
    const swept = auth.createSession(data('swept'));
    vi.advanceTimersByTime(auth.SESSION_MAX_AGE_MS - 1);
    expect(auth.getSession(read)).not.toBeNull();

    vi.advanceTimersByTime(60 * 60 * 1000 + 1); // past expiry, triggers a sweep
    expect(auth.getSession(read)).toBeNull();
    expect(auth.getSession(swept)).toBeNull();
  });
});
