import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession, getSession } from './auth.js';
import { findOriginalYears } from './originalYear.js';
import { findPreview } from './preview.js';

/** Title → the year MusicBrainz knows the song from (none: Spotify's year). */
const originalYears = vi.hoisted(() => new Map<string, number>());

// One search per batch; titles with "NoYear" are unknown to MusicBrainz.
vi.mock('./originalYear.js', () => ({
  findOriginalYears: vi.fn(async (queries: Array<{ title: string; latest: number }>, stats?: { lookups: number }) => {
    if (stats) stats.lookups++;
    return queries.map((q) => (q.title.includes('NoYear') ? null : (originalYears.get(q.title) ?? q.latest)));
  }),
}));

// The preview URL depends on the title only, so two tracks with the same title share a preview.
vi.mock('./preview.js', () => ({
  findPreview: vi.fn(async (_artist: string, title: string, _durationMs: number, stats?: { lookups: number }) => {
    if (stats) stats.lookups++;
    if (title.includes('NoPreview')) return null;
    return `https://audio-ssl.itunes.apple.com/${encodeURIComponent(title)}`;
  }),
}));

type SpotifyModule = typeof import('./spotify.js');
let spotify: SpotifyModule;

const fetchMock = vi.fn();
const json = (body: unknown, ok = true, status = ok ? 200 : 500, headers: Record<string, string> = {}) => ({
  ok,
  status,
  headers: new Headers(headers),
  json: async () => body,
});

interface TrackInput {
  id?: string;
  name?: string;
  artists?: Array<{ name: string }>;
  release?: string;
  albumType?: string;
  albumName?: string;
  images?: Array<{ url: string }>;
  isrc?: string;
}

const item = (t: TrackInput | null) =>
  t === null
    ? { track: null }
    : {
        track: {
          id: t.id ?? t.name,
          name: t.name,
          duration_ms: 200_000,
          external_ids: t.isrc ? { isrc: t.isrc } : {},
          artists: t.artists ?? [{ name: 'Band' }],
          album: {
            name: t.albumName ?? 'Album',
            album_type: t.albumType ?? 'album',
            release_date: t.release ?? '1980-01-01',
            images: t.images ?? [{ url: 'https://cover' }],
          },
        },
      };

/** `/items` for apps created since Feb 2026: the song under `item`, `track` only a boolean. */
const newItem = (t: TrackInput) => ({ item: item(t).track, track: true });

/** Routes Spotify API calls to canned pages keyed by path prefix; a number answers with that status. */
function spotifyPages(pages: Record<string, unknown>) {
  fetchMock.mockImplementation(async (url: string) => {
    const path = url.replace('https://api.spotify.com/v1', '');
    const key = Object.keys(pages).find((k) => path.startsWith(k));
    if (key === undefined) return json({}, false);
    const page = pages[key];
    return typeof page === 'number' ? json({}, false, page) : json(page);
  });
}

const requestedPaths = () =>
  fetchMock.mock.calls.map(([url]) => String(url).replace('https://api.spotify.com/v1', ''));

beforeAll(async () => {
  // spotify.ts starts its cleanup interval on import, so fake timers must be on first.
  vi.useFakeTimers();
  spotify = await import('./spotify.js');
});

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  originalYears.clear();
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

  it('asks Spotify who logged in, to tell own playlists from followed ones', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }))
      .mockResolvedValueOnce(json({ id: 'host-user' }));
    expect(await spotify.exchangeCode('code', stateOf(spotify.getAuthUrl()))).toMatchObject({ userId: 'host-user' });
    expect(requestedPaths()[1]).toBe('/me');
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

  it('keeps the user id when refreshing', async () => {
    const id = createSession({ accessToken: 'old', refreshToken: 'r', expiresAt: Date.now() - 1, userId: 'host-user' });
    fetchMock.mockResolvedValueOnce(json({ access_token: 'new', expires_in: 3600 }));
    await spotify.getValidToken(id);
    expect(getSession(id)).toMatchObject({ accessToken: 'new', userId: 'host-user' });
  });

  it('gives up when the refresh fails', async () => {
    const id = createSession({ accessToken: 'old', refreshToken: 'r', expiresAt: Date.now() - 1 });
    fetchMock.mockResolvedValueOnce(json({}, false));
    expect(await spotify.getValidToken(id)).toBeNull();
  });
});

describe('getUserPlaylists', () => {
  it('maps playlists in the old and the new format and tolerates missing covers', async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        items: [
          { id: 'p1', name: 'Rock', images: [{ url: 'https://img' }], tracks: { total: 3 }, owner: { display_name: 'Me' } },
          { id: 'p2', name: 'Empty', images: null, items: { total: 0 }, owner: { display_name: 'Me' } },
          { id: 'p3', name: 'New', images: [], items: { total: 7 }, owner: { display_name: 'Me' } },
        ],
      }),
    );
    expect(await spotify.getUserPlaylists('token')).toEqual({
      ok: true,
      playlists: [
        { id: 'p1', name: 'Rock', coverUrl: 'https://img', trackCount: 3, ownerName: 'Me' },
        { id: 'p2', name: 'Empty', coverUrl: null, trackCount: 0, ownerName: 'Me' },
        { id: 'p3', name: 'New', coverUrl: null, trackCount: 7, ownerName: 'Me' },
      ],
    });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { Authorization: 'Bearer token' } });
  });

  it('says why Spotify refused the list', async () => {
    const problemFor = async (answer: unknown) => {
      fetchMock.mockReset();
      if (answer instanceof Error) fetchMock.mockRejectedValueOnce(answer);
      else fetchMock.mockResolvedValueOnce(answer);
      return spotify.getUserPlaylists('token');
    };
    expect(await problemFor(json({}, false, 403))).toEqual({ ok: false, problem: 'not_allowlisted' });
    expect(await problemFor(json({}, false, 429))).toEqual({ ok: false, problem: 'quota' });
    expect(await problemFor(json({}, false, 500))).toEqual({ ok: false, problem: 'unavailable' });
    expect(await problemFor(new Error('timeout'))).toEqual({ ok: false, problem: 'unavailable' });
  });
});

describe('getUserPlaylists pages', () => {
  const playlist = (id: string) => ({ id, name: id, images: [], tracks: { total: 1 }, owner: { display_name: '' } });

  it('reads further pages, up to 200 playlists, and keeps what it has when a page fails', async () => {
    // Endless pages of 50: the reader stops after 4.
    fetchMock.mockImplementation(async (url: string) => {
      const offset = Number(new URL(url).searchParams.get('offset') ?? 0);
      return json({
        items: Array.from({ length: 50 }, (_, i) => playlist(`p${offset + i}`)),
        next: `https://api.spotify.com/v1/me/playlists?offset=${offset + 50}&limit=50`,
      });
    });
    const many = await spotify.getUserPlaylists('token');
    expect(many.ok && many.playlists).toHaveLength(200);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(requestedPaths()[1]).toBe('/me/playlists?offset=50&limit=50');

    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(json({ items: [playlist('a')], next: 'https://api.spotify.com/v1/me/playlists?offset=50' }))
      .mockResolvedValueOnce(json({}, false, 500));
    const partial = await spotify.getUserPlaylists('token');
    expect(partial.ok && partial.playlists.map((p) => p.id)).toEqual(['a']);
  });
});

describe('Spotify rate limits (429 with Retry-After)', () => {
  const playlists = json({ items: [] });
  const limited = (seconds?: number) =>
    json({}, false, 429, seconds === undefined ? {} : { 'Retry-After': String(seconds) });

  it('sits out a short wait once and asks again', async () => {
    fetchMock.mockResolvedValueOnce(limited(2)).mockResolvedValueOnce(playlists);
    const result = spotify.getUserPlaylists('token');
    await vi.advanceTimersByTimeAsync(2000);
    expect(await result).toEqual({ ok: true, playlists: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // A second short wait in a row gives up rather than looping.
    fetchMock.mockResolvedValueOnce(limited(1)).mockResolvedValueOnce(limited(1));
    const again = spotify.getUserPlaylists('token');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await again).toEqual({ ok: false, problem: 'quota' });
  });

  it('sends nothing to Spotify during a long wait, for any host', async () => {
    fetchMock.mockResolvedValueOnce(limited(600));
    expect(await spotify.getUserPlaylists('token')).toEqual({ ok: false, problem: 'quota' });
    expect(await spotify.getUserPlaylists('other host')).toEqual({ ok: false, problem: 'quota' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(600_000);
    fetchMock.mockResolvedValueOnce(playlists);
    expect(await spotify.getUserPlaylists('token')).toEqual({ ok: true, playlists: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('without Retry-After only fails that one request', async () => {
    fetchMock.mockResolvedValueOnce(limited()).mockResolvedValueOnce(playlists);
    expect(await spotify.getUserPlaylists('token')).toEqual({ ok: false, problem: 'quota' });
    expect(await spotify.getUserPlaylists('token')).toEqual({ ok: true, playlists: [] });
  });
});

describe('loadSongs', () => {
  const load = (ids: string[], target: number, exclude: string[] = [], signal = new AbortController().signal) =>
    spotify.loadSongs('token', ids, target, new Set(exclude), signal);

  it('keeps only songs with a confirmed year and a preview', async () => {
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
          item({ name: 'NoYear Song' }),
          item({ name: 'Live Take - 1999 Version', artists: [], images: [] }),
        ],
        next: null,
      },
    });
    const { songs, previewStats, yearsUnconfirmed } = await load(['p1'], 50);
    expect(songs.map((s) => [s.title, s.year])).toEqual(
      expect.arrayContaining([
        ['Classic', 1975],
        ['Live Take', 1980],
      ]),
    );
    expect(songs).toHaveLength(2);
    expect(songs.find((s) => s.title === 'Live Take')).toMatchObject({ artist: 'Unknown', cover: null });
    // Classic, NoPreview Song, Live Take: a song without a confirmed year isn't searched on iTunes.
    expect(previewStats.lookups).toBe(3);
    expect(yearsUnconfirmed).toBe(1);
  });

  it('drops remixes, live takes, re-recordings and remasters, but not titles that only sound like one', async () => {
    spotifyPages({
      '/playlists/p1/': {
        items: [
          item({ name: 'Cheerleader - Felix Jaehn Remix Radio Edit' }),
          item({ name: "Love Story (Taylor's Version)" }),
          item({ name: 'Bohemian Rhapsody - Live at Wembley Stadium' }),
          item({ name: 'About a Girl', albumName: 'MTV Unplugged in New York' }),
          item({ name: 'Gracias a la Vida - Remasterizado' }),
          item({ name: 'Live and Let Die' }),
          item({ name: 'Levels - Original Mix' }),
        ],
        next: null,
      },
    });
    const { songs } = await load(['p1'], 50);
    expect(songs.map((s) => s.title).sort()).toEqual(['Levels - Original Mix', 'Live and Let Die']);
  });

  it('counts a song once, whichever version or playlist it comes from', async () => {
    spotifyPages({
      '/playlists/p1/': {
        items: [
          item({ id: 'a', name: 'Suga Suga', artists: [{ name: 'Baby Bash' }], isrc: 'USA1' }),
          item({ id: 'b', name: 'Other', isrc: 'USB2' }),
        ],
        next: null,
      },
      '/playlists/p2/': {
        items: [
          item({ id: 'c', name: 'Suga Suga - Radio Edit', artists: [{ name: 'Baby Bash' }] }), // same artist and title
          item({ id: 'd', name: 'Renamed On A Best-Of', isrc: 'USB2' }), // same recording
          item({ id: 'e', name: 'Other', artists: [{ name: 'Band & Friend' }] }), // same preview
        ],
        next: null,
      },
    });
    const { songs, duplicatesRemoved } = await load(['p1', 'p2'], 50);
    expect(songs.map((s) => s.title).sort()).toEqual(['Other', 'Suga Suga']);
    expect(songs.map((s) => s.id)).toContain('a');
    expect(duplicatesRemoved).toBe(3);
  });

  it('takes the year from MusicBrainz, since Spotify often only knows a later release', async () => {
    originalYears.set('Classic Hit', 1969);
    spotifyPages({
      '/playlists/p1/': {
        items: [item({ name: 'Classic Hit', release: '2009-03-01' }), item({ name: 'New Song', release: '2001-01-01' })],
        next: null,
      },
    });
    const { songs, yearsCorrected, yearStats, previewsUnavailable, yearsUnavailable } = await load(['p1'], 50);
    expect([previewsUnavailable, yearsUnavailable]).toEqual([false, false]);
    expect(Object.fromEntries(songs.map((s) => [s.title, s.year]))).toEqual({ 'Classic Hit': 1969, 'New Song': 2001 });
    expect(yearsCorrected).toBe(1);
    // Both songs in one search, each up to its Spotify year.
    expect(yearStats.lookups).toBe(1);
    expect(findOriginalYears).toHaveBeenCalledWith(
      expect.arrayContaining([{ artist: 'Band', title: 'Classic Hit', durationMs: 200_000, latest: 2009 }]),
      yearStats,
      expect.any(AbortSignal),
    );
    // iTunes gets Spotify's length to tell recordings apart, and the load's signal to stop waiting.
    expect(findPreview).toHaveBeenCalledWith('Band', 'Classic Hit', 200_000, expect.anything(), expect.any(AbortSignal));
    // Only the song fields reach the client.
    expect(Object.keys(songs[0]).sort()).toEqual(['artist', 'cover', 'id', 'preview', 'title', 'year']);
  });

  it('reads every page, dedupes across playlists and keeps songs when a later page fails', async () => {
    // More specific paths first: spotifyPages takes the first matching prefix.
    spotifyPages({
      '/playlists/p1/items?limit=50&offset=50': { items: [item({ id: 'b', name: 'B' })], total: 100 },
      '/playlists/p1/': { items: [item({ id: 'a', name: 'A' })], total: 100 },
      '/playlists/p2/': { items: [item({ id: 'a', name: 'A' })], total: 1 },
      '/playlists/p3/items?limit=50&offset=50': 500,
      '/playlists/p3/': { items: [item({ id: 'c', name: 'C' })], total: 100 },
    });
    const { songs, unavailablePlaylists } = await load(['p1', 'p2', 'p3'], 50);
    expect(songs.map((s) => s.id).sort()).toEqual(['a', 'b', 'c']);
    expect(unavailablePlaylists).toEqual([]);
  });

  it('reads a long playlist up to 300 songs, from random pages instead of always its start', async () => {
    const total = 500;
    fetchMock.mockImplementation(async (url: string) => {
      const offset = Number(new URL(url).searchParams.get('offset') ?? 0);
      const items = Array.from({ length: 50 }, (_, i) => item({ id: `t${offset + i}`, name: `T${offset + i}` }));
      return json({ items, total });
    });
    const pagesRead = new Set<number>();
    for (let run = 0; run < 20; run++) {
      fetchMock.mockClear();
      await load(['p1'], 1);
      const offsets = requestedPaths().map((p) => Number(new URL(p, 'https://x').searchParams.get('offset') ?? 0));
      // The first page plus five more make 300 songs.
      expect(offsets).toHaveLength(6);
      expect(offsets[0]).toBe(0);
      expect(new Set(offsets).size).toBe(6);
      for (const o of offsets) pagesRead.add(o);
    }
    // Over 20 loads, every page of the playlist was read at some point (the end included).
    expect([...pagesRead].sort((a, b) => a - b)).toEqual(Array.from({ length: 10 }, (_, i) => i * 50));
  });

  it('reads /items in pages of 50, with the song under item (new apps) or track (older apps)', async () => {
    spotifyPages({
      '/playlists/p1/items': { items: [newItem({ id: 'n', name: 'New' }), item({ id: 'o', name: 'Old' })], next: null },
    });
    const { songs } = await load(['p1'], 50);
    expect(songs.map((s) => s.id).sort()).toEqual(['n', 'o']);
    expect(requestedPaths()).toEqual(['/playlists/p1/items?limit=50']);
  });

  it('falls back to /tracks when an app gets no answer from /items', async () => {
    spotifyPages({
      '/playlists/p1/items': 404,
      '/playlists/p1/tracks': { items: [item({ id: 'a', name: 'A' })], next: null },
    });
    const { songs, unavailablePlaylists } = await load(['p1'], 50);
    expect(songs.map((s) => s.id)).toEqual(['a']);
    expect(unavailablePlaylists).toEqual([]);
    expect(requestedPaths()[1]).toMatch(/^\/playlists\/p1\/tracks\?fields=.*&limit=100$/);
  });

  it('pages /tracks by 100', async () => {
    spotifyPages({
      '/playlists/p1/items': 404,
      '/playlists/p1/tracks': { items: [item({ id: 'a', name: 'A' })], total: 150 },
    });
    await load(['p1'], 50);
    expect(requestedPaths()[2]).toMatch(/^\/playlists\/p1\/tracks\?fields=.*total.*&limit=100&offset=100$/);
  });

  it('says which playlists Spotify refused and why', async () => {
    spotifyPages({
      '/playlists/ok/': { items: [item({ id: 'a', name: 'A' })], next: null },
      '/playlists/followed/': 403,
      '/playlists/editorial/': 404,
      '/playlists/busy/': 429,
      '/playlists/down/': 503,
    });
    const { songs, unavailablePlaylists } = await load(['ok', 'followed', 'editorial', 'busy', 'down'], 50);
    expect(songs.map((s) => s.id)).toEqual(['a']);
    expect(unavailablePlaylists).toEqual([
      { id: 'followed', problem: 'not_owned' },
      { id: 'editorial', problem: 'spotify_owned' },
      { id: 'busy', problem: 'quota' },
      { id: 'down', problem: 'unavailable' },
    ]);
    // An exhausted quota isn't asked a second time via /tracks.
    expect(requestedPaths().filter((p) => p.startsWith('/playlists/busy/'))).toHaveLength(1);
  });

  it('uses already played songs only as a reserve', async () => {
    spotifyPages({
      '/playlists/p1/': {
        items: ['a', 'b', 'c', 'd'].map((id) => item({ id, name: id.toUpperCase() })),
        next: null,
      },
    });
    const fresh = await load(['p1'], 2, ['a', 'b']);
    expect(fresh.songs.map((s) => s.id).sort()).toEqual(['c', 'd']);

    const withReserve = await load(['p1'], 10, ['a', 'b']);
    expect(withReserve.songs).toHaveLength(4);
  });

  it('counts another version of a played song as played', async () => {
    spotifyPages({
      '/playlists/p1/': { items: [item({ id: 'a', name: 'A' }), item({ id: 'b', name: 'B' })], next: null },
      '/playlists/p2/': { items: [item({ id: 'a2', name: 'A - Radio Edit' })], next: null },
    });
    const { songs } = await load(['p1', 'p2'], 1, ['a2']);
    expect(songs.map((s) => s.id)).toEqual(['b']);
  });

  it('stops asking iTunes once it keeps refusing', async () => {
    vi.mocked(findPreview).mockImplementation(async (_artist, _title, _durationMs, stats) => {
      if (stats) {
        stats.lookups++;
        stats.failed++;
      }
      return null;
    });
    spotifyPages({
      '/playlists/p1/': {
        items: Array.from({ length: 40 }, (_, i) => item({ id: `t${i}`, name: `T${i}` })),
        next: null,
      },
    });
    const { songs, previewStats, previewsUnavailable } = await load(['p1'], 20);
    expect(songs).toEqual([]);
    // One batch of 10 went out; after its failures no further batch does.
    expect(previewStats).toEqual({ lookups: 10, failed: 10, waitedMs: 0 });
    // The client then says to wait, rather than to pick other playlists.
    expect(previewsUnavailable).toBe(true);
    vi.mocked(findPreview).mockReset();
  });

  it('stops asking MusicBrainz once it keeps failing, and plays no song with an unconfirmed year', async () => {
    vi.mocked(findOriginalYears).mockImplementation(async (queries, stats) => {
      if (stats) {
        stats.lookups++;
        stats.failed++;
      }
      return queries.map(() => null);
    });
    spotifyPages({
      '/playlists/p1/': {
        items: Array.from({ length: 50 }, (_, i) => item({ id: `t${i}`, name: `T${i}` })),
        next: null,
      },
    });
    const { songs, yearStats, previewStats, yearsUnavailable, yearsUnconfirmed, previewsUnavailable } = await load(
      ['p1'],
      40,
    );
    expect(songs).toEqual([]);
    // Three batches failed; the other two aren't asked.
    expect(yearStats).toEqual({ lookups: 3, failed: 3, waitedMs: 0 });
    expect(yearsUnconfirmed).toBe(30);
    expect(previewStats.lookups).toBe(0);
    // The client then says to wait, rather than to pick other playlists.
    expect([yearsUnavailable, previewsUnavailable]).toEqual([true, false]);
    vi.mocked(findOriginalYears).mockReset();
  });

  it('stops once the target is reached or the request is aborted', async () => {
    spotifyPages({
      '/playlists/p1/': {
        items: Array.from({ length: 25 }, (_, i) => item({ id: `t${i}`, name: `T${i}` })),
        next: null,
      },
    });
    expect((await load(['p1'], 5)).songs).toHaveLength(5);

    const aborted = new AbortController();
    aborted.abort();
    expect((await load(['p1'], 5, [], aborted.signal)).songs).toEqual([]);
  });
});

/** `/me/playlists` with the fields that tell snapshots and followed playlists apart. */
const listing = (...playlists: Array<{ id: string; snapshot?: string; owner?: string; collaborative?: boolean }>) => ({
  items: playlists.map((p) => ({
    id: p.id,
    name: p.id,
    images: [],
    items: { total: 1 },
    owner: { id: p.owner ?? 'me', display_name: p.owner ?? 'me' },
    collaborative: p.collaborative ?? false,
    snapshot_id: p.snapshot ?? 'v1',
  })),
});

describe('playlist cache', () => {
  it('reads a playlist from Spotify once per session, snapshot and few hours', async () => {
    const session = 'cache-session';
    const pages = (snapshot: string) => ({
      '/me/playlists': listing({ id: 'p1', snapshot }),
      '/playlists/p1/items?limit=50&offset=50': { items: [item({ id: 'b', name: 'B' })], total: 100 },
      '/playlists/p1/': { items: [item({ id: 'a', name: 'A' })], total: 100 },
    });
    const loadAs = (sessionId = session) =>
      spotify.loadSongs('token', ['p1'], 50, new Set(), new AbortController().signal, sessionId);
    const listAs = (sessionId = session) => spotify.getUserPlaylists('token', { sessionId, userId: 'me' });

    spotifyPages(pages('v1'));
    await listAs();
    expect((await loadAs()).pageStats).toEqual({ fetched: 2, cached: 0 });
    const again = await loadAs();
    expect(again.pageStats).toEqual({ fetched: 0, cached: 2 });
    expect(again.songs.map((s) => s.id).sort()).toEqual(['a', 'b']);

    // Another session gets nothing from this one's cache (and caches nothing it didn't list).
    expect((await loadAs('other-session')).pageStats).toEqual({ fetched: 2, cached: 0 });

    // A changed playlist has a new snapshot: read again.
    spotifyPages(pages('v2'));
    await listAs();
    expect((await loadAs()).pageStats).toEqual({ fetched: 2, cached: 0 });

    // Six hours later the cache is gone.
    vi.advanceTimersByTime(6 * 60 * 60 * 1000);
    await listAs();
    expect((await loadAs()).pageStats).toEqual({ fetched: 2, cached: 0 });
  });
});

// Last in the file: once Spotify refuses a followed playlist, that holds for the whole module.
describe('followed playlists', () => {
  it('are offered until Spotify refuses one, then left out; own and collaborative ones stay', async () => {
    const host = { sessionId: 'host-session', userId: 'me' };
    const ids = async (who: { sessionId: string; userId?: string } = host) => {
      const result = await spotify.getUserPlaylists('token', who);
      return result.ok ? result.playlists.map((p) => p.id) : result;
    };
    const load = (id: string) =>
      spotify.loadSongs('token', [id], 5, new Set(), new AbortController().signal, host.sessionId);
    const playlists = listing(
      { id: 'own' },
      { id: 'shared', owner: 'friend', collaborative: true },
      { id: 'followed', owner: 'hitster' },
    );

    spotifyPages({ '/me/playlists': playlists, '/playlists/': 403 });
    expect(await ids()).toEqual(['own', 'shared', 'followed']);
    // Spotify refusing the host's own playlist says nothing about followed ones.
    await load('own');
    expect(await ids()).toEqual(['own', 'shared', 'followed']);

    await load('followed');
    expect(await ids()).toEqual(['own', 'shared']);
    // Without the host's user id there's no telling which ones are followed.
    expect(await ids({ sessionId: 'unknown-user' })).toEqual(['own', 'shared', 'followed']);
  });
});
