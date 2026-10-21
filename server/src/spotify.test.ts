import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession, getSession } from './auth.js';

vi.mock('./preview.js', () => ({
  findPreview: vi.fn(async (_artist: string, title: string) =>
    title.includes('NoPreview') ? null : `https://audio-ssl.itunes.apple.com/${encodeURIComponent(title)}`,
  ),
}));

type SpotifyModule = typeof import('./spotify.js');
let spotify: SpotifyModule;

const fetchMock = vi.fn();
const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body });

interface TrackInput {
  id?: string;
  name?: string;
  artists?: Array<{ name: string }>;
  release?: string;
  albumType?: string;
  albumName?: string;
  images?: Array<{ url: string }>;
}

const item = (t: TrackInput | null) =>
  t === null
    ? { track: null }
    : {
        track: {
          id: t.id ?? t.name,
          name: t.name,
          artists: t.artists ?? [{ name: 'Band' }],
          album: {
            name: t.albumName ?? 'Album',
            album_type: t.albumType ?? 'album',
            release_date: t.release ?? '1980-01-01',
            images: t.images ?? [{ url: 'https://cover' }],
          },
        },
      };

/** Routes Spotify API calls to canned playlist pages keyed by path prefix. */
function spotifyPages(pages: Record<string, unknown>) {
  fetchMock.mockImplementation(async (url: string) => {
    const path = url.replace('https://api.spotify.com/v1', '');
    const key = Object.keys(pages).find((k) => path.startsWith(k));
    return key ? json(pages[key]) : json({}, false);
  });
}

beforeAll(async () => {
  // spotify.ts starts its cleanup interval on import, so fake timers must be on first.
  vi.useFakeTimers();
  spotify = await import('./spotify.js');
});

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OAuth', () => {
  const stateOf = (url: string) => new URL(url).searchParams.get('state')!;

  it('builds a PKCE authorize url', () => {
    const url = new URL(spotify.getAuthUrl());
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/);
    expect(url.searchParams.get('state')).toMatch(/^[0-9a-f]{32}$/);
  });

  it('exchanges a code once per state', async () => {
    const state = stateOf(spotify.getAuthUrl());
    fetchMock.mockResolvedValueOnce(json({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }));
    const session = await spotify.exchangeCode('code', state);
    expect(session).toMatchObject({ accessToken: 'at', refreshToken: 'rt' });
    expect(session!.expiresAt).toBe(Date.now() + 3540 * 1000);
    expect(await spotify.exchangeCode('code', state)).toBeNull();
  });

  it('rejects unknown states, failed exchanges and expired states', async () => {
    expect(await spotify.exchangeCode('code', 'unknown')).toBeNull();

    fetchMock.mockResolvedValueOnce(json({}, false));
    expect(await spotify.exchangeCode('code', stateOf(spotify.getAuthUrl()))).toBeNull();

    const stale = stateOf(spotify.getAuthUrl());
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect(await spotify.exchangeCode('code', stale)).toBeNull();
  });

  it('sweeps expired states in the background', async () => {
    const state = stateOf(spotify.getAuthUrl());
    vi.advanceTimersByTime(11 * 60 * 1000); // past expiry and at least one sweep
    fetchMock.mockResolvedValueOnce(json({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }));
    expect(await spotify.exchangeCode('code', state)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('defaults a missing refresh token to an empty string', async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: 'at', expires_in: 3600 }));
    expect(await spotify.exchangeCode('c', stateOf(spotify.getAuthUrl()))).toMatchObject({ refreshToken: '' });
  });
});

describe('getValidToken', () => {
  it('returns null for unknown sessions and the token while it is valid', async () => {
    expect(await spotify.getValidToken('nope')).toBeNull();
    const id = createSession({ accessToken: 'fresh', refreshToken: 'r', expiresAt: Date.now() + 60_000 });
    expect(await spotify.getValidToken(id)).toBe('fresh');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes an expired token and keeps the old refresh token if none comes back', async () => {
    const id = createSession({ accessToken: 'old', refreshToken: 'keep', expiresAt: Date.now() - 1 });
    fetchMock.mockResolvedValueOnce(json({ access_token: 'new', expires_in: 3600 }));
    expect(await spotify.getValidToken(id)).toBe('new');
    expect(getSession(id)).toMatchObject({ accessToken: 'new', refreshToken: 'keep' });

    const rotated = createSession({ accessToken: 'old', refreshToken: 'r1', expiresAt: Date.now() - 1 });
    fetchMock.mockResolvedValueOnce(json({ access_token: 'n', refresh_token: 'r2', expires_in: 3600 }));
    await spotify.getValidToken(rotated);
    expect(getSession(rotated)).toMatchObject({ refreshToken: 'r2' });
  });

  it('gives up when the refresh fails', async () => {
    const id = createSession({ accessToken: 'old', refreshToken: 'r', expiresAt: Date.now() - 1 });
    fetchMock.mockResolvedValueOnce(json({}, false));
    expect(await spotify.getValidToken(id)).toBeNull();
  });
});

describe('getUserPlaylists', () => {
  it('maps playlists and tolerates missing covers', async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        items: [
          { id: 'p1', name: 'Rock', images: [{ url: 'https://img' }], tracks: { total: 3 }, owner: { display_name: 'Me' } },
          { id: 'p2', name: 'Empty', images: [], tracks: { total: 0 }, owner: { display_name: 'Me' } },
        ],
      }),
    );
    expect(await spotify.getUserPlaylists('token')).toEqual([
      { id: 'p1', name: 'Rock', coverUrl: 'https://img', trackCount: 3, ownerName: 'Me' },
      { id: 'p2', name: 'Empty', coverUrl: null, trackCount: 0, ownerName: 'Me' },
    ]);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { Authorization: 'Bearer token' } });
  });

  it('returns nothing when Spotify fails', async () => {
    fetchMock.mockResolvedValueOnce(json({}, false));
    expect(await spotify.getUserPlaylists('token')).toEqual([]);
  });
});

describe('loadSongs', () => {
  const load = (ids: string[], target: number, exclude: string[] = [], signal = new AbortController().signal) =>
    spotify.loadSongs('token', ids, target, new Set(exclude), signal);

  it('keeps only songs with a reliable year and a preview', async () => {
    spotifyPages({
      '/playlists/p1/': {
        items: [
          item(null),
          item({ name: 'Classic', release: '1975-06-01' }),
          item({ name: 'Old Song - 2011 Remaster' }),
          item({ name: 'From A Compilation', albumType: 'compilation' }),
          item({ name: 'Reissued', albumName: 'Rumours (Super Deluxe)' }),
          item({ name: 'Hits Again', albumName: 'Greatest Hits' }),
          item({ name: 'No Date', release: '' }),
          item({ name: 'NoPreview Song' }),
          item({ name: 'Live Take - 1999 Version', artists: [], images: [] }),
        ],
        next: null,
      },
    });
    const result = await load(['p1'], 50);
    expect(result.map((s) => [s.title, s.year])).toEqual(
      expect.arrayContaining([
        ['Classic', 1975],
        ['Live Take', 1980],
      ]),
    );
    expect(result).toHaveLength(2);
    expect(result.find((s) => s.title === 'Live Take')).toMatchObject({ artist: 'Unknown', cover: null });
  });

  it('follows pagination, dedupes across playlists and stops on errors', async () => {
    spotifyPages({
      '/playlists/p1/tracks?fields': {
        items: [item({ id: 'a', name: 'A' })],
        next: 'https://api.spotify.com/v1/playlists/p1/page2',
      },
      '/playlists/p1/page2': { items: [item({ id: 'b', name: 'B' })], next: null },
      '/playlists/p2/': { items: [item({ id: 'a', name: 'A' })], next: null },
    });
    const result = await load(['p1', 'p2', 'broken'], 50);
    expect(result.map((s) => s.id).sort()).toEqual(['a', 'b']);
  });

  it('uses already played songs only as a reserve', async () => {
    spotifyPages({
      '/playlists/p1/': {
        items: ['a', 'b', 'c', 'd'].map((id) => item({ id, name: id.toUpperCase() })),
        next: null,
      },
    });
    const fresh = await load(['p1'], 2, ['a', 'b']);
    expect(fresh.map((s) => s.id).sort()).toEqual(['c', 'd']);

    const withReserve = await load(['p1'], 10, ['a', 'b']);
    expect(withReserve).toHaveLength(4);
  });

  it('stops once the target is reached or the request is aborted', async () => {
    spotifyPages({
      '/playlists/p1/': {
        items: Array.from({ length: 25 }, (_, i) => item({ id: `t${i}`, name: `T${i}` })),
        next: null,
      },
    });
    expect(await load(['p1'], 5)).toHaveLength(5);

    const aborted = new AbortController();
    aborted.abort();
    expect(await load(['p1'], 5, [], aborted.signal)).toEqual([]);
  });
});
