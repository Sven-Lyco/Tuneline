import { randomBytes, createHash } from 'crypto';
import type { SongFull, SpotifyPlaylist } from '@tuneline/shared';
import { type SessionData, getSession, updateSession } from './auth.js';
import { findPreview } from './preview.js';
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

async function spotifyFetch<T>(token: string, path: string): Promise<T | null> {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  return response.json() as Promise<T>;
}

// ── Playlists ─────────────────────────────────────────────────────────────────

interface SpotifyPlaylistsResponse {
  items: Array<{
    id: string;
    name: string;
    images: Array<{ url: string }>;
    tracks: { total: number };
    owner: { display_name: string };
  }>;
}

export async function getUserPlaylists(token: string): Promise<SpotifyPlaylist[]> {
  const result = await spotifyFetch<SpotifyPlaylistsResponse>(token, '/me/playlists?limit=50');
  if (!result?.items) return [];

  return result.items.map((p) => ({
    id: p.id,
    name: p.name,
    coverUrl: p.images?.[0]?.url ?? null,
    trackCount: p.tracks.total,
    ownerName: p.owner.display_name,
  }));
}

// ── Tracks ────────────────────────────────────────────────────────────────────

interface SpotifyTracksResponse {
  items: Array<{
    track: {
      id: string;
      name: string;
      artists: Array<{ name: string }>;
      album: {
        release_date: string;
        images: Array<{ url: string }>;
      };
    } | null;
  }>;
  next: string | null;
}

const YEAR_PATTERN = /[\s–-]+[\[(]?(?:remaster(?:ed)?|live|single version|anniversary|deluxe)?[\s]?\d{4}[\s]?(?:remaster(?:ed)?|version|edit|mix|anniversary)?[\])]?$/i;

function sanitizeTitle(raw: string): string {
  return raw.replace(YEAR_PATTERN, '').trim();
}

interface TrackData {
  id: string;
  title: string;
  artist: string;
  year: number;
  cover: string | null;
}

function parseTrack(item: SpotifyTracksResponse['items'][number]): TrackData | null {
  const t = item.track;
  if (!t?.id || !t.name) return null;

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

async function getPlaylistTracks(token: string, playlistId: string): Promise<TrackData[]> {
  const tracks: TrackData[] = [];
  const fields = 'items(track(id,name,artists(name),album(release_date,images))),next';
  let path: string | null =
    `/playlists/${playlistId}/tracks?fields=${encodeURIComponent(fields)}&limit=100`;

  while (path && tracks.length < 300) {
    const result: SpotifyTracksResponse | null = await spotifyFetch<SpotifyTracksResponse>(token, path);
    if (!result?.items) break;

    for (const item of result.items) {
      const track = parseTrack(item);
      if (track) tracks.push(track);
    }

    path = result.next ? result.next.replace('https://api.spotify.com/v1', '') : null;
  }

  return tracks;
}

// ── Song loading with iTunes enrichment ──────────────────────────────────────

export async function loadSongs(
  token: string,
  playlistIds: string[],
  target: number,
): Promise<SongFull[]> {
  const tracksByPlaylist = await Promise.all(playlistIds.map((id) => getPlaylistTracks(token, id)));

  const seenIds = new Set<string>();
  const allTracks: TrackData[] = [];

  for (const tracks of tracksByPlaylist) {
    for (const track of shuffle(tracks)) {
      if (!seenIds.has(track.id)) {
        seenIds.add(track.id);
        allTracks.push(track);
      }
    }
  }

  const shuffled = shuffle(allTracks);

  const BATCH = 10;
  const result: SongFull[] = [];

  for (let i = 0; i < shuffled.length && result.length < target; i += BATCH) {
    const batch = shuffled.slice(i, i + BATCH);
    const enriched = await Promise.all(
      batch.map(async (track): Promise<SongFull | null> => {
        const preview = await findPreview(track.artist, track.title);
        if (!preview) return null;
        return { ...track, preview };
      })
    );
    result.push(...enriched.filter((s): s is SongFull => s !== null));
  }

  return result;
}
