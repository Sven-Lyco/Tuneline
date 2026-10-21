import { randomBytes, createHash } from 'crypto';
import type {
  PlaylistProblem,
  SongFull,
  SongsResponse,
  SpotifyPlaylist,
  SpotifyProblem,
} from '@tuneline/shared';
import { type SessionData, getSession, updateSession } from './auth.js';
import { logger } from './logger.js';
import { type PreviewStats, findPreview } from './preview.js';
import { shuffle } from './utils.js';

const SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

// ── PKCE helpers ─────────────────────────────────────────────────────────────

function generateVerifier(): string {
  return randomBytes(64).toString('base64url');
}

function generateChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

// ── Pending OAuth states ──────────────────────────────────────────────────────

interface PendingState {
  verifier: string;
  expiresAt: number;
}

const pendingStates = new Map<string, PendingState>();

// Clean up expired states periodically
setInterval(() => {
  const now = Date.now();
  for (const [state, pending] of pendingStates) {
    if (now > pending.expiresAt) pendingStates.delete(state);
  }
}, 60_000);

// ── Auth URL ──────────────────────────────────────────────────────────────────

export function getAuthUrl(): string {
  const verifier = generateVerifier();
  const challenge = generateChallenge(verifier);
  const state = randomBytes(16).toString('hex');

  pendingStates.set(state, { verifier, expiresAt: Date.now() + 10 * 60 * 1000 });

  const params = new URLSearchParams({
    client_id: (process.env.SPOTIFY_CLIENT_ID ?? ''),
    response_type: 'code',
    redirect_uri: (process.env.SPOTIFY_REDIRECT_URI ?? ''),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  });

  return `https://accounts.spotify.com/authorize?${params}`;
}

// ── Token exchange ────────────────────────────────────────────────────────────

export async function exchangeCode(code: string, state: string): Promise<SessionData | null> {
  const pending = pendingStates.get(state);
  if (!pending || Date.now() > pending.expiresAt) {
    pendingStates.delete(state);
    return null;
  }
  pendingStates.delete(state);

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: (process.env.SPOTIFY_CLIENT_ID ?? ''),
      grant_type: 'authorization_code',
      code,
      redirect_uri: (process.env.SPOTIFY_REDIRECT_URI ?? ''),
      code_verifier: pending.verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) return null;
  const data = await response.json() as { access_token: string; refresh_token: string; expires_in: number };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? '',
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
}

// ── Token refresh ─────────────────────────────────────────────────────────────

async function refreshToken(session: SessionData): Promise<SessionData | null> {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: (process.env.SPOTIFY_CLIENT_ID ?? ''),
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) return null;
  const data = await response.json() as { access_token: string; refresh_token?: string; expires_in: number };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? session.refreshToken,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
}

// ── Get valid token (auto-refresh) ────────────────────────────────────────────

export async function getValidToken(sessionId: string): Promise<string | null> {
  const session = getSession(sessionId);
  if (!session) return null;

  if (Date.now() < session.expiresAt) return session.accessToken;

  const refreshed = await refreshToken(session);
  if (!refreshed) return null;

  updateSession(sessionId, refreshed);
  return refreshed.accessToken;
}

// ── Spotify API fetch ─────────────────────────────────────────────────────────

/** `status` 0 = no answer (network error or timeout). */
type SpotifyResult<T> = { ok: true; data: T } | { ok: false; status: number };

async function spotifyFetch<T>(token: string, path: string): Promise<SpotifyResult<T>> {
  try {
    const response = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, status: 0 };
  }
}

// ── Playlists ─────────────────────────────────────────────────────────────────

interface SpotifyPlaylistsResponse {
  items: Array<{
    id: string;
    name: string;
    images: Array<{ url: string }> | null;
    // Apps created since Feb 2026 get the count under `items`, older ones under `tracks`.
    items?: { total: number };
    tracks?: { total: number };
    owner: { display_name: string };
  }>;
}

export type PlaylistsResult =
  | { ok: true; playlists: SpotifyPlaylist[] }
  | { ok: false; problem: SpotifyProblem };

export async function getUserPlaylists(token: string): Promise<PlaylistsResult> {
  const result = await spotifyFetch<SpotifyPlaylistsResponse>(token, '/me/playlists?limit=50');
  if (!result.ok) {
    // 403: the user isn't on the app's allowlist (Development Mode).
    const problem = result.status === 403 ? 'not_allowlisted' : result.status === 429 ? 'quota' : 'unavailable';
    return { ok: false, problem };
  }

  const playlists = (result.data.items ?? []).filter(Boolean).map((p) => ({
    id: p.id,
    name: p.name,
    coverUrl: p.images?.[0]?.url ?? null,
    trackCount: (p.items ?? p.tracks)?.total ?? 0,
    ownerName: p.owner?.display_name ?? '',
  }));
  return { ok: true, playlists };
}

// ── Tracks ────────────────────────────────────────────────────────────────────

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    album_type: string;
    release_date: string;
    images: Array<{ url: string }>;
  };
}

interface SpotifyTracksResponse {
  items: Array<{
    // `/items` (apps since Feb 2026) puts the song under `item` and turns `track` into a
    // boolean; `/tracks` and older apps put it under `track`.
    item?: SpotifyTrack | null;
    track?: SpotifyTrack | boolean | null;
  }>;
  next: string | null;
}

const YEAR_PATTERN = /[\s–-]+[\[(]?(?:remaster(?:ed)?|live|single version|anniversary|deluxe)?[\s]?\d{4}[\s]?(?:remaster(?:ed)?|version|edit|mix|anniversary)?[\])]?$/i;
const REMASTER_PATTERN = /\bremaster(?:ed|ing)?\b/i;
// Re-releases carry the reissue date, not the song's original year.
const REISSUE_ALBUM_PATTERN =
  /\b(?:greatest hits|best of|very best|essential|anniversary|deluxe|expanded|remaster(?:ed)?|collection|anthology)\b/i;

function sanitizeTitle(raw: string): string {
  return raw.replace(YEAR_PATTERN, '').trim();
}

function isRemastered(rawTitle: string): boolean {
  return REMASTER_PATTERN.test(rawTitle);
}

interface TrackData {
  id: string;
  title: string;
  artist: string;
  year: number;
  cover: string | null;
}

function parseTrack(entry: SpotifyTracksResponse['items'][number]): TrackData | null {
  const t =
    typeof entry.item === 'object' && entry.item
      ? entry.item
      : typeof entry.track === 'object'
        ? entry.track
        : null;
  if (!t?.id || !t.name) return null;
  if (isRemastered(t.name)) return null;
  if (t.album?.album_type === 'compilation' || REISSUE_ALBUM_PATTERN.test(t.album?.name ?? '')) {
    return null;
  }

  const year = t.album?.release_date ? parseInt(t.album.release_date.split('-')[0], 10) : 0;
  if (year < 1900 || year > 2100) return null;

  return {
    id: t.id,
    title: sanitizeTitle(t.name),
    artist: t.artists?.[0]?.name ?? 'Unknown',
    year,
    cover: t.album?.images?.[0]?.url ?? null,
  };
}

function playlistProblem(status: number): PlaylistProblem {
  if (status === 403) return 'not_owned'; // new apps: only playlists the host owns or collaborates on
  if (status === 404) return 'spotify_owned'; // Spotify's editorial/algorithmic playlists (or deleted)
  if (status === 429) return 'quota';
  return 'unavailable';
}

/**
 * Reads up to 300 songs. `/items` (max. 50 per page) replaced `/tracks` in Feb 2026, and Spotify
 * only postponed switching off `/tracks` for older apps — so `/items` comes first, and a refused
 * first page falls back to `/tracks` for apps that don't know `/items` yet.
 */
async function getPlaylistTracks(
  token: string,
  playlistId: string,
): Promise<{ tracks: TrackData[]; problem: PlaylistProblem | null }> {
  const id = encodeURIComponent(playlistId);
  const legacyFields = 'items(track(id,name,artists(name),album(name,album_type,release_date,images))),next';
  let first = await spotifyFetch<SpotifyTracksResponse>(token, `/playlists/${id}/items?limit=50`);
  // A 429 means the app's quota is used up; asking again would only make it worse.
  if (!first.ok && first.status !== 429) {
    const legacy = await spotifyFetch<SpotifyTracksResponse>(
      token,
      `/playlists/${id}/tracks?fields=${encodeURIComponent(legacyFields)}&limit=100`,
    );
    if (legacy.ok) {
      // Shows in the log whether this app still depends on /tracks.
      logger.info({ playlistId, itemsStatus: first.status }, 'playlist_items_fallback');
      first = legacy;
    }
  }
  if (!first.ok) return { tracks: [], problem: playlistProblem(first.status) };

  const tracks: TrackData[] = [];
  let page: SpotifyTracksResponse | null = first.data;
  while (page?.items && tracks.length < 300) {
    for (const entry of page.items) {
      const track = parseTrack(entry);
      if (track) tracks.push(track);
    }
    if (!page.next) break;
    // A later page failing keeps the songs read so far.
    const nextPath: string = page.next.replace('https://api.spotify.com/v1', '');
    const next: SpotifyResult<SpotifyTracksResponse> = await spotifyFetch(token, nextPath);
    page = next.ok ? next.data : null;
  }

  return { tracks, problem: null };
}

// ── Song loading with iTunes enrichment ──────────────────────────────────────

export interface LoadSongsResult extends SongsResponse {
  previewStats: PreviewStats;
}

/** `excludeIds` (songs from earlier games) are only used once the fresh songs run out. */
export async function loadSongs(
  token: string,
  playlistIds: string[],
  target: number,
  excludeIds: Set<string>,
  signal: AbortSignal,
): Promise<LoadSongsResult> {
  const byPlaylist = await Promise.all(playlistIds.map((id) => getPlaylistTracks(token, id)));
  const unavailablePlaylists = byPlaylist.flatMap(({ problem }, i) =>
    problem ? [{ id: playlistIds[i], problem }] : [],
  );

  const seenIds = new Set<string>();
  const allTracks: TrackData[] = [];

  for (const { tracks } of byPlaylist) {
    for (const track of shuffle(tracks)) {
      if (!seenIds.has(track.id)) {
        seenIds.add(track.id);
        allTracks.push(track);
      }
    }
  }

  const shuffled = [
    ...shuffle(allTracks.filter((t) => !excludeIds.has(t.id))),
    ...shuffle(allTracks.filter((t) => excludeIds.has(t.id))),
  ];

  const BATCH = 10;
  const result: SongFull[] = [];
  const previewStats: PreviewStats = { lookups: 0, failed: 0 };

  for (let i = 0; i < shuffled.length && result.length < target && !signal.aborted; i += BATCH) {
    const batch = shuffled.slice(i, i + BATCH);
    const enriched = await Promise.all(
      batch.map(async (track): Promise<SongFull | null> => {
        const preview = await findPreview(track.artist, track.title, previewStats);
        if (!preview) return null;
        return { ...track, preview };
      })
    );
    result.push(...enriched.filter((s): s is SongFull => s !== null));
  }

  // The last batch can overshoot into reserve songs; fresh ones come first, so trim from the end.
  return { songs: result.slice(0, target), unavailablePlaylists, previewStats };
}
