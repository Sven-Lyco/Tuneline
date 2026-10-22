import { logger } from './logger.js';
import { baseTitle, normalize, versionOf } from './versions.js';

interface ItunesTrack {
  previewUrl?: string | null;
  trackName: string;
  artistName: string;
  collectionName?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
}

interface ItunesSearchResult {
  results: ItunesTrack[];
}

/** An iTunes recording of the searched song that has a preview. */
interface Candidate {
  previewUrl: string;
  remaster: boolean;
  year: number; // 0 = unknown
  durationMs: number; // 0 = unknown
}

export interface PreviewMatch {
  preview: string;
  /**
   * Earliest year iTunes knows the song from. iTunes keeps the original date on best-ofs and
   * reissues, where Spotify gives the album's date. null = unknown.
   */
  originalYear: number | null;
}

/**
 * Results by the same artist whose title is the same song in its original recording (or a
 * remaster of it). Remixes, live takes, karaoke and the like would play another sound than the
 * card promises; another song by that artist would play another title and year.
 */
function candidates(results: ItunesTrack[], artist: string, title: string): Candidate[] {
  const normArtist = normalize(artist);
  const normTitle = normalize(title);
  const base = baseTitle(title);
  if (!normArtist || !normTitle) return [];

  return results.flatMap((r) => {
    if (!r.previewUrl || !normalize(r.artistName).includes(normArtist)) return [];
    // A title made only of brackets ("(Untitled)") has no base to compare variants with.
    const sameSong = base ? baseTitle(r.trackName) === base : normalize(r.trackName) === normTitle;
    if (!sameSong) return [];
    const version = versionOf(r.trackName, r.collectionName);
    if (version === 'variant') return [];
    return [
      {
        previewUrl: r.previewUrl,
        remaster: version === 'remaster',
        year: parseInt(r.releaseDate ?? '', 10) || 0,
        durationMs: r.trackTimeMillis ?? 0,
      },
    ];
  });
}

// Lengths further apart than this are another recording ("chopped & screwed", a re-recording …).
const MAX_LENGTH_DIFFERENCE = 0.4;

/** The original before a remaster, then the length closest to Spotify's, then the oldest release. */
function pickBest(found: Candidate[], durationMs: number): PreviewMatch | null {
  const off = (c: Candidate) => (durationMs > 0 && c.durationMs > 0 ? Math.abs(c.durationMs - durationMs) : 0);
  const fitting = found.filter((c) => off(c) <= durationMs * MAX_LENGTH_DIFFERENCE);
  if (fitting.length === 0) return null;

  const oldest = (c: Candidate) => c.year || Infinity;
  const [best] = [...fitting].sort(
    (a, b) => Number(a.remaster) - Number(b.remaster) || off(a) - off(b) || oldest(a) - oldest(b),
  );
  const years = fitting.map((c) => c.year).filter((y) => y >= 1900);
  return { preview: best.previewUrl, originalYear: years.length > 0 ? Math.min(...years) : null };
}

// In-memory cache: "artist|title" → matching recordings (max 2000 entries, LRU-eviction). The pick
// happens per call, since the Spotify length can differ between two tracks with the same title.
const cache = new Map<string, Candidate[]>();
const CACHE_MAX = 2000;

function cacheSet(key: string, value: Candidate[]): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

/**
 * iTunes searches that went out (cache misses) and how many failed. Apple allows roughly 20 per
 * minute per IP; the failures show whether song loading runs into that limit.
 */
export interface PreviewStats {
  lookups: number;
  failed: number;
}

/** `durationMs`: the Spotify track's length (0 = unknown), to tell recordings apart. */
export async function findPreview(
  artist: string,
  title: string,
  durationMs = 0,
  stats?: PreviewStats,
): Promise<PreviewMatch | null> {
  const cacheKey = `${artist}|${title}`;

  const cached = cache.get(cacheKey);
  if (cached) return pickBest(cached, durationMs);
  if (stats) stats.lookups++;

  try {
    const query = encodeURIComponent(`${artist} ${title}`);
    // 25 results: with fewer, the original often hides behind remixes, live takes and instrumentals.
    const response = await fetch(
      `https://itunes.apple.com/search?term=${query}&entity=song&limit=25`,
      { signal: AbortSignal.timeout(6000) },
    );

    // Not cached: 403/429/5xx are transient (iTunes throttling), not "no preview".
    if (!response.ok) {
      if (stats) stats.failed++;
      logger.warn({ artist, title, status: response.status }, 'itunes_fetch_error');
      return null;
    }

    const data = (await response.json()) as ItunesSearchResult;
    const found = candidates(data.results, artist, title);
    cacheSet(cacheKey, found);
    const match = pickBest(found, durationMs);
    logger.debug({ artist, title, found: match !== null }, 'preview_fetched');
    return match;
  } catch (err) {
    if (stats) stats.failed++;
    logger.warn({ artist, title, err }, 'itunes_fetch_exception');
    return null;
  }
}
