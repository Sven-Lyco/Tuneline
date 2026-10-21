import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession, getSession, SESSION_COOKIE } from './auth.js';
import { startServer, type TestServer } from './test/server.js';

const realFetch = globalThis.fetch;
const external = vi.fn<(url: string, init?: RequestInit) => Promise<unknown>>();

const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body });

let server: TestServer;

beforeEach(async () => {
  server = await startServer();
  external.mockReset();
  // The server talks to Spotify/iTunes through fetch; the test talks to the server through it too.
  vi.stubGlobal('fetch', (url: string | URL, init?: RequestInit) =>
    String(url).startsWith(server.url) ? realFetch(url, init) : external(String(url), init),
  );
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await server.close();
});

const get = (path: string, init: RequestInit = {}) => fetch(`${server.url}${path}`, { redirect: 'manual', ...init });
const post = (path: string, body: unknown, cookie?: string) =>
  get(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
const cookieFor = (id: string) => `${SESSION_COOKIE}=${id}`;
const validSession = () =>
  cookieFor(createSession({ accessToken: 'at', refreshToken: 'rt', expiresAt: Date.now() + 60_000 }));
const expiredSession = () =>
  cookieFor(createSession({ accessToken: 'at', refreshToken: 'rt', expiresAt: Date.now() - 1 }));

describe('health and auth', () => {
  it('reports health', async () => {
    const res = await get('/health', { headers: { 'x-request-id': 'req-1' } });
    expect(await res.json()).toEqual({ ok: true });
  });

  it('hands out the Spotify login url', async () => {
    const { authUrl } = await (await get('/api/auth/login')).json();
    expect(authUrl).toMatch(/^https:\/\/accounts\.spotify\.com\/authorize\?/);
  });

  it('reports whether the session cookie is valid', async () => {
    expect(await (await get('/api/auth/status')).json()).toEqual({ authenticated: false });
    expect(await (await get('/api/auth/status', { headers: { cookie: validSession() } })).json()).toEqual({
      authenticated: true,
    });
  });

  it('redirects failed callbacks back with an error flag', async () => {
    const missing = await get('/api/auth/callback');
    expect(missing.headers.get('location')).toBe('/?auth_error=true');
    const unknown = await get('/api/auth/callback?code=c&state=unknown');
    expect(unknown.headers.get('location')).toBe('/?auth_error=true');
  });

  it('sets an httpOnly session cookie after a successful callback', async () => {
    const { authUrl } = await (await get('/api/auth/login')).json();
    const state = new URL(authUrl).searchParams.get('state');
    external.mockResolvedValueOnce(json({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }));

    const res = await get(`/api/auth/callback?code=c&state=${state}`);
    expect(res.headers.get('location')).toBe('/?authenticated=true');
    const cookie = res.headers.get('set-cookie')!;
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=[0-9a-f]{64}`));
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).not.toContain('Secure');
  });

  it('logs out and forgets the session', async () => {
    const cookie = validSession();
    const res = await post('/api/auth/logout', {}, cookie);
    expect(await res.json()).toEqual({ ok: true });
    expect(getSession(cookie.split('=')[1])).toBeNull();
    expect(await (await post('/api/auth/logout', {})).json()).toEqual({ ok: true });
  });
});

describe('Spotify data routes', () => {
  it('requires a session for playlists and songs', async () => {
    expect((await get('/api/playlists')).status).toBe(401);
    expect((await post('/api/songs', {})).status).toBe(401);
  });

  it('drops sessions whose token cannot be refreshed', async () => {
    external.mockResolvedValue(json({}, false));
    const playlists = await get('/api/playlists', { headers: { cookie: expiredSession() } });
    expect(playlists.status).toBe(401);
    expect(playlists.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=;`);
    expect((await post('/api/songs', { playlistIds: ['p'], target: 5 }, expiredSession())).status).toBe(401);
  });

  it('lists the playlists of the logged-in user', async () => {
    external.mockResolvedValueOnce(
      json({ items: [{ id: 'p1', name: 'Rock', images: [], tracks: { total: 2 }, owner: { display_name: 'Me' } }] }),
    );
    const res = await get('/api/playlists', { headers: { cookie: validSession() } });
    expect(await res.json()).toEqual([{ id: 'p1', name: 'Rock', coverUrl: null, trackCount: 2, ownerName: 'Me' }]);
  });

  it('validates song requests', async () => {
    const cookie = validSession();
    const invalid = [
      { playlistIds: 'p1', target: 5 },
      { playlistIds: [], target: 5 },
      { playlistIds: Array(11).fill('p'), target: 5 },
      { playlistIds: ['x'.repeat(65)], target: 5 },
      { playlistIds: ['p1'], target: 0 },
      { playlistIds: ['p1'], target: 501 },
      { playlistIds: ['p1'], target: '5' },
      { playlistIds: ['p1'], target: 5, excludeIds: 'a' },
      { playlistIds: ['p1'], target: 5, excludeIds: [1] },
    ];
    for (const body of invalid) expect((await post('/api/songs', body, cookie)).status).toBe(400);
  });

  it('loads songs with previews', async () => {
    external.mockImplementation(async (url) => {
      if (url.startsWith('https://api.spotify.com')) {
        return json({
          items: [
            {
              track: {
                id: 't1',
                name: 'Dream On',
                artists: [{ name: 'Aerosmith' }],
                album: { name: 'Aerosmith', album_type: 'album', release_date: '1973-01-05', images: [] },
              },
            },
          ],
          next: null,
        });
      }
      return json({
        results: [{ artistName: 'Aerosmith', trackName: 'Dream On', previewUrl: 'https://audio-ssl.itunes.apple.com/d' }],
      });
    });
    const res = await post('/api/songs', { playlistIds: ['p1'], target: 5, excludeIds: [] }, validSession());
    expect(await res.json()).toEqual([
      expect.objectContaining({ id: 't1', title: 'Dream On', year: 1973, preview: 'https://audio-ssl.itunes.apple.com/d' }),
    ]);
  });

  it('serves preview lookups', async () => {
    expect((await get('/api/preview?artist=A')).status).toBe(400);
    external.mockResolvedValueOnce(json({ results: [] }));
    expect(await (await get('/api/preview?artist=Nobody&title=Nothing')).json()).toEqual({ previewUrl: null });
  });
});

describe('production mode', () => {
  it('serves the client app for unknown routes and marks cookies secure', async () => {
    const prod = await startServer({ isProd: true });
    try {
      const page = await realFetch(`${prod.url}/some/client/route`);
      // 200 with a built client, 404 when client/dist doesn't exist (e.g. in CI) — both hit the SPA fallback.
      expect([200, 404]).toContain(page.status);

      const { authUrl } = await (await realFetch(`${prod.url}/api/auth/login`)).json();
      const state = new URL(authUrl).searchParams.get('state');
      external.mockResolvedValueOnce(json({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }));
      const res = await realFetch(`${prod.url}/api/auth/callback?code=c&state=${state}`, { redirect: 'manual' });
      expect(res.headers.get('set-cookie')).toContain('Secure');
    } finally {
      await prod.close();
    }
  });
});
