import { STORAGE_KEYS } from '../constants';

/**
 * Songs this device played lately — beyond the room, so a new room on the same evening starts
 * with other songs. The server only falls back to them once the fresh ones run out.
 */
interface PlayedSongs {
  ids: string[];
  savedAt: number;
}

/** Same cap as the server's /api/songs validation; the most recent songs matter most. */
export const MAX_PLAYED_SONGS = 1000;

// One party evening; the next day every song is fresh again.
const PLAYED_SONGS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function readPlayedSongs(): string[] {
  try {
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.playedSongs) ?? 'null'
    ) as PlayedSongs | null;
    return stored &&
      Array.isArray(stored.ids) &&
      Date.now() - stored.savedAt < PLAYED_SONGS_MAX_AGE_MS
      ? stored.ids
      : [];
  } catch {
    return [];
  }
}

export function savePlayedSongs(ids: Iterable<string>): void {
  try {
    localStorage.setItem(
      STORAGE_KEYS.playedSongs,
      JSON.stringify({ ids: [...ids].slice(-MAX_PLAYED_SONGS), savedAt: Date.now() })
    );
  } catch {
    // Storage full or blocked: the next room may repeat songs, nothing else breaks.
  }
}
