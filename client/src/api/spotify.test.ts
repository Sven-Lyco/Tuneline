import { describe, expect, it, vi } from 'vitest';
import {
  getUserPlaylists,
  isAuthenticated,
  loadSongsFromPlaylists,
  logout,
  redirectToSpotify,
} from './spotify';
import { sortByYear } from '../utils/shuffle';

const respond = (body: unknown, ok = true, status = ok ? 200 : 500) =>
  vi.fn(async () => ({ ok, status, json: async () => body }));

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

  it('loads playlists and says why there are none', async () => {
    vi.stubGlobal('fetch', respond([{ id: 'p1' }]));
    expect(await getUserPlaylists()).toEqual({ playlists: [{ id: 'p1' }], problem: null });

    const problemFor = async (body: unknown, status: number) => {
      vi.stubGlobal('fetch', respond(body, false, status));
      return (await getUserPlaylists()).problem;
    };
    expect(await problemFor({ error: 'not_allowlisted' }, 403)).toBe('not_allowlisted');
    expect(await problemFor({ error: 'quota' }, 429)).toBe('quota');
    expect(await problemFor({ error: 'Not authenticated' }, 401)).toBe('logged_out');
    expect(await problemFor({ error: 'something new' }, 502)).toBe('unavailable');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await getUserPlaylists()).toEqual({ playlists: [], problem: 'unavailable' });
  });

  it('loads songs with exclusions and an abort signal, empty on errors', async () => {
    const loaded = { songs: [{ id: 's1' }], unavailablePlaylists: [], previewsUnavailable: false };
    const fetch = respond(loaded);
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    expect(await loadSongsFromPlaylists(['p1'], 10, ['old'], signal)).toEqual(loaded);
    expect(fetch).toHaveBeenCalledWith('/api/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlistIds: ['p1'], target: 10, excludeIds: ['old'] }),
      signal,
    });

    const nothing = { songs: [], unavailablePlaylists: [], previewsUnavailable: false };
    vi.stubGlobal('fetch', respond({}, false));
    expect(await loadSongsFromPlaylists(['p1'], 10, [], signal)).toEqual(nothing);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('aborted')));
    expect(await loadSongsFromPlaylists(['p1'], 10, [], signal)).toEqual(nothing);
  });

  it('treats an unreadable response body as empty', async () => {
    const broken = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => Promise.reject(new Error('bad json')),
    }));
    vi.stubGlobal('fetch', broken);
    expect(await loadSongsFromPlaylists(['p1'], 10, [], new AbortController().signal)).toEqual({
      songs: [],
      unavailablePlaylists: [],
      previewsUnavailable: false,
    });
    expect(await getUserPlaylists()).toEqual({ playlists: [], problem: 'unavailable' });
  });
});

describe('sortByYear', () => {
  it('sorts a copy by year', () => {
    const input = [{ year: 1990 }, { year: 1970 }];
    expect(sortByYear(input)).toEqual([{ year: 1970 }, { year: 1990 }]);
    expect(input[0].year).toBe(1990);
  });
});
