import { describe, expect, it, vi } from 'vitest';
import {
  getUserPlaylists,
  isAuthenticated,
  loadSongsFromPlaylists,
  logout,
  redirectToSpotify,
} from './spotify';
import { sortByYear } from '../utils/shuffle';

const respond = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }));

describe('api/spotify', () => {
  it('redirects to the Spotify login', async () => {
    vi.stubGlobal('fetch', respond({ authUrl: 'https://accounts.spotify.com/authorize?x=1' }));
    const location = { href: '' };
    vi.stubGlobal('location', location);
    Object.defineProperty(window, 'location', { configurable: true, value: location });
    await redirectToSpotify();
    expect(location.href).toBe('https://accounts.spotify.com/authorize?x=1');
  });

  it('checks the login status and treats errors as logged out', async () => {
    vi.stubGlobal('fetch', respond({ authenticated: true }));
    expect(await isAuthenticated()).toBe(true);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await isAuthenticated()).toBe(false);
  });

  it('logs out via POST', async () => {
    const fetch = respond({ ok: true });
    vi.stubGlobal('fetch', fetch);
    await logout();
    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
  });

  it('loads playlists, empty on errors', async () => {
    vi.stubGlobal('fetch', respond([{ id: 'p1' }]));
    expect(await getUserPlaylists()).toEqual([{ id: 'p1' }]);
    vi.stubGlobal('fetch', respond([], false));
    expect(await getUserPlaylists()).toEqual([]);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await getUserPlaylists()).toEqual([]);
  });

  it('loads songs with exclusions and an abort signal, empty on errors', async () => {
    const fetch = respond([{ id: 's1' }]);
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    expect(await loadSongsFromPlaylists(['p1'], 10, ['old'], signal)).toEqual([{ id: 's1' }]);
    expect(fetch).toHaveBeenCalledWith('/api/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlistIds: ['p1'], target: 10, excludeIds: ['old'] }),
      signal,
    });

    vi.stubGlobal('fetch', respond([], false));
    expect(await loadSongsFromPlaylists(['p1'], 10, [], signal)).toEqual([]);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('aborted')));
    expect(await loadSongsFromPlaylists(['p1'], 10, [], signal)).toEqual([]);
  });

  it('treats an unreadable response body as empty', async () => {
    const broken = vi.fn(async () => ({
      ok: true,
      json: async () => Promise.reject(new Error('bad json')),
    }));
    vi.stubGlobal('fetch', broken);
    expect(await loadSongsFromPlaylists(['p1'], 10, [], new AbortController().signal)).toEqual([]);
    expect(await getUserPlaylists()).toEqual([]);
  });
});

describe('sortByYear', () => {
  it('sorts a copy by year', () => {
    const input = [{ year: 1990 }, { year: 1970 }];
    expect(sortByYear(input)).toEqual([{ year: 1970 }, { year: 1990 }]);
    expect(input[0].year).toBe(1990);
  });
});
