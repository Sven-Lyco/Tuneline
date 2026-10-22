import type { PlaylistProblem, SongsResponse, SpotifyPlaylist } from '@tuneline/shared';
import type { PlaylistsProblem } from '../api/spotify';

/** Shown instead of the playlist grid; Spotify's limits are explained in the README setup. */
export const PLAYLISTS_PROBLEM_MESSAGES: Record<PlaylistsProblem, string> = {
  not_allowlisted:
    'Dein Spotify-Konto ist für diese Tuneline-App nicht freigeschaltet. Bitte den Betreiber, dich im Spotify-Dashboard unter „User Management“ einzutragen.',
  quota:
    'Spotify hat das Abfrage-Kontingent dieser App ausgeschöpft. Bitte versuch es später noch einmal.',
  unavailable: 'Spotify ist gerade nicht erreichbar. Bitte versuch es später noch einmal.',
  logged_out: 'Deine Spotify-Anmeldung ist abgelaufen. Bitte melde dich neu an.',
};

const PLAYLIST_PROBLEM_REASONS: Record<PlaylistProblem, string> = {
  not_owned: 'Spotify gibt nur Songs aus eigenen oder gemeinsamen Playlisten frei',
  spotify_owned: 'Playlisten von Spotify selbst sind für Tuneline gesperrt',
  quota: 'das Spotify-Kontingent ist gerade ausgeschöpft',
  unavailable: 'Spotify war nicht erreichbar',
};

/** One sentence per reason ("Nicht geladen: „Rock“ – …"), or null when every playlist loaded. */
export function unavailablePlaylistsMessage(
  unavailable: SongsResponse['unavailablePlaylists'],
  playlists: SpotifyPlaylist[]
): string | null {
  if (unavailable.length === 0) return null;
  const namesByProblem = new Map<PlaylistProblem, string[]>();
  for (const { id, problem } of unavailable) {
    const name = `„${playlists.find((p) => p.id === id)?.name ?? 'Playlist'}“`;
    namesByProblem.set(problem, [...(namesByProblem.get(problem) ?? []), name]);
  }
  return [...namesByProblem]
    .map(
      ([problem, names]) =>
        `Nicht geladen: ${names.join(', ')} – ${PLAYLIST_PROBLEM_REASONS[problem]}.`
    )
    .join(' ');
}
