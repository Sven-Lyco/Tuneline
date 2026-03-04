import type { Genre, Song } from '../types';
import { GENRE_QUERIES } from '../constants';
import { shuffle } from '../utils/shuffle';

const PROXY = 'https://corsproxy.io/?';

interface DeezerTrack {
  id: number;
  title: string;
  title_short?: string;
  preview: string;
  artist?: { name: string };
  album?: { id: number; release_date?: string; cover_medium?: string; cover?: string };
}

interface DeezerSearchResult {
  data: DeezerTrack[];
}

interface DeezerAlbum {
  release_date: string;
}

async function deezerFetch<T>(path: string): Promise<T | null> {
  try {
    const url = `${PROXY}${encodeURIComponent(`https://api.deezer.com${path}`)}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch (e) {
    console.warn('Deezer API error:', e);
    return null;
  }
}

function extractYear(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const y = parseInt(dateStr.split('-')[0], 10);
  return y > 1900 && y < 2030 ? y : null;
}

function trackToSong(t: DeezerTrack): Song | null {
  if (!t || !t.preview || !t.title) return null;
  const year = extractYear(t.album?.release_date);
  if (!year) return null;
  return {
    id: t.id,
    title: t.title_short || t.title,
    artist: t.artist?.name || 'Unknown',
    year,
    preview: t.preview,
    cover: t.album?.cover_medium || t.album?.cover || null,
  };
}

export async function loadSongsForGenres(genres: Genre[], targetCount = 80): Promise<Song[]> {
  const allSongs: Song[] = [];
  const seenIds = new Set<number>();

  let queries = genres.flatMap((g) => GENRE_QUERIES[g] || []);
  queries = shuffle(queries);

  for (const q of queries) {
    if (allSongs.length >= targetCount) break;
    const data = await deezerFetch<DeezerSearchResult>(
      `/search?q=${encodeURIComponent(q)}&limit=25`
    );
    if (!data?.data) continue;

    for (const track of data.data) {
      if (seenIds.has(track.id)) continue;
      let song = trackToSong(track);
      if (!song && track.album?.id) {
        const albumData = await deezerFetch<DeezerAlbum>(`/album/${track.album.id}`);
        if (albumData?.release_date) {
          track.album.release_date = albumData.release_date;
          song = trackToSong(track);
        }
      }
      if (song) {
        seenIds.add(track.id);
        allSongs.push(song);
      }
    }
  }

  return shuffle(allSongs);
}
