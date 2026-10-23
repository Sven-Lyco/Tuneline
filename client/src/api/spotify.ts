import type { SongsResponse, SpotifyPlaylist, SpotifyProblem } from '@tuneline/shared';

/** Why the playlist list stayed empty: Spotify's reason, or an expired login (HTTP 401). */
export type PlaylistsProblem = SpotifyProblem | 'logged_out';

export interface PlaylistsResult {
  playlists: SpotifyPlaylist[];
  problem: PlaylistsProblem | null;
}

const SPOTIFY_PROBLEMS: readonly string[] = [
  'not_allowlisted',
  'quota',
  'unavailable',
] satisfies SpotifyProblem[];

export async function redirectToSpotify(): Promise<void> {
  const res = await fetch('/api/auth/login');
  const { authUrl } = (await res.json()) as { authUrl: string };
  window.location.href = authUrl;
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/status');
    const data = (await res.json()) as { authenticated: boolean };
    return data.authenticated;
  } catch {
    return false;
  }
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}

export async function getUserPlaylists(): Promise<PlaylistsResult> {
  try {
    const res = await fetch('/api/playlists');
    if (res.ok) return { playlists: (await res.json()) as SpotifyPlaylist[], problem: null };
    if (res.status === 401) return { playlists: [], problem: 'logged_out' };
    const { error } = (await res.json().catch(() => ({}))) as { error?: string };
    const problem = SPOTIFY_PROBLEMS.includes(error ?? '')
      ? (error as SpotifyProblem)
      : 'unavailable';
    return { playlists: [], problem };
  } catch {
    return { playlists: [], problem: 'unavailable' };
  }
}

/** `excludeIds` are songs from earlier games; the server only falls back to them if needed. */
export async function loadSongsFromPlaylists(
  playlistIds: string[],
  target: number,
  excludeIds: string[],
  signal: AbortSignal
): Promise<SongsResponse> {
  const nothing: SongsResponse = {
    songs: [],
    unavailablePlaylists: [],
    previewsUnavailable: false,
  };
  try {
    const res = await fetch('/api/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlistIds, target, excludeIds }),
      signal,
    });
    if (!res.ok) return nothing;
    return (await res.json()) as SongsResponse;
  } catch {
    return nothing;
  }
}
