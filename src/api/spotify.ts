import type { Song, SpotifyPlaylist } from '../types';
import { shuffle } from '../utils/shuffle';

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string;
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI as string;
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

const CODE_VERIFIER_KEY = 'tuneline_code_verifier';
const TOKEN_KEY = 'tuneline_token';

// ── Token storage ──────────────────────────────────────────────

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

function storeToken(data: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  refresh_token_old?: string;
}): void {
  const existing = getStoredTokenData();
  const tokenData: TokenData = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? existing?.refreshToken ?? '',
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
}

function getStoredTokenData(): TokenData | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TokenData;
  } catch {
    return null;
  }
}

// ── PKCE helpers ───────────────────────────────────────────────

function generateCodeVerifier(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// ── Auth ───────────────────────────────────────────────────────

export async function redirectToSpotify(): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  sessionStorage.setItem(CODE_VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export async function handleAuthCallback(code: string): Promise<boolean> {
  const verifier = sessionStorage.getItem(CODE_VERIFIER_KEY);
  if (!verifier) return false;

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) return false;

  storeToken(await response.json());
  sessionStorage.removeItem(CODE_VERIFIER_KEY);
  return true;
}

export async function getValidToken(): Promise<string | null> {
  const data = getStoredTokenData();
  if (!data) return null;

  if (Date.now() < data.expiresAt) return data.accessToken;

  // Refresh expired token
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: data.refreshToken,
    }),
  });

  if (!response.ok) {
    logout();
    return null;
  }

  const refreshed = await response.json();
  storeToken(refreshed);
  return refreshed.access_token as string;
}

export function isAuthenticated(): boolean {
  return getStoredTokenData() !== null;
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ── API fetch ──────────────────────────────────────────────────

async function spotifyFetch<T>(path: string): Promise<T | null> {
  const token = await getValidToken();
  if (!token) return null;

  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) return null;
  return response.json() as Promise<T>;
}

// ── Playlists ──────────────────────────────────────────────────

interface SpotifyPlaylistsResponse {
  items: Array<{
    id: string;
    name: string;
    images: Array<{ url: string }>;
    tracks: { total: number };
    owner: { display_name: string };
  }>;
}

export async function getUserPlaylists(): Promise<SpotifyPlaylist[]> {
  const result = await spotifyFetch<SpotifyPlaylistsResponse>('/me/playlists?limit=50');
  if (!result?.items) return [];

  return result.items.map((p) => ({
    id: p.id,
    name: p.name,
    coverUrl: p.images?.[0]?.url ?? null,
    trackCount: p.tracks.total,
    ownerName: p.owner.display_name,
  }));
}

// ── Tracks ─────────────────────────────────────────────────────

interface SpotifyTracksResponse {
  items: Array<{
    track: {
      id: string;
      name: string;
      uri: string;
      artists: Array<{ name: string }>;
      album: {
        release_date: string;
        images: Array<{ url: string }>;
      };
    } | null;
  }>;
  next: string | null;
}

function parseTrack(item: SpotifyTracksResponse['items'][number]): Song | null {
  const t = item.track;
  if (!t?.id || !t.uri || !t.name) return null;

  const year = t.album?.release_date ? parseInt(t.album.release_date.split('-')[0], 10) : 0;
  if (year < 1900 || year >= 2030) return null;

  return {
    id: t.id,
    uri: t.uri,
    title: t.name,
    artist: t.artists?.[0]?.name ?? 'Unknown',
    year,
    cover: t.album?.images?.[0]?.url ?? null,
  };
}

async function getPlaylistTracks(playlistId: string): Promise<Song[]> {
  const songs: Song[] = [];
  const fields = 'items(track(id,name,uri,artists(name),album(release_date,images))),next';
  let path: string | null =
    `/playlists/${playlistId}/tracks?fields=${encodeURIComponent(fields)}&limit=100`;

  while (path && songs.length < 300) {
    const result: SpotifyTracksResponse | null = await spotifyFetch<SpotifyTracksResponse>(path);
    if (!result?.items) break;

    for (const item of result.items) {
      const song = parseTrack(item);
      if (song) songs.push(song);
    }

    path = result.next ? result.next.replace('https://api.spotify.com/v1', '') : null;
  }

  return songs;
}

export async function loadSongsFromPlaylists(
  playlistIds: string[],
  limit: number
): Promise<Song[]> {
  const tracksByPlaylist = await Promise.all(playlistIds.map(getPlaylistTracks));
  const perPlaylist = Math.ceil(limit / playlistIds.length);

  const seenIds = new Set<string>();
  const allSongs: Song[] = [];

  for (const tracks of tracksByPlaylist) {
    let count = 0;
    for (const song of shuffle(tracks)) {
      if (count >= perPlaylist) break;
      if (!seenIds.has(song.id)) {
        seenIds.add(song.id);
        allSongs.push(song);
        count++;
      }
    }
  }

  return shuffle(allSongs);
}
