import type { SpotifyPlaylist, SongFull } from '@tuneline/shared';

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

export async function getUserPlaylists(): Promise<SpotifyPlaylist[]> {
  try {
    const res = await fetch('/api/playlists');
    if (!res.ok) return [];
    return res.json() as Promise<SpotifyPlaylist[]>;
  } catch {
    return [];
  }
}

export async function loadSongsFromPlaylists(
  playlistIds: string[],
  target: number,
): Promise<SongFull[]> {
  try {
    const res = await fetch('/api/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlistIds, target }),
    });
    if (!res.ok) return [];
    return res.json() as Promise<SongFull[]>;
  } catch {
    return [];
  }
}
