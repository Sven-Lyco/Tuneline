import { TokenBucket } from './limits.js';
import { logger } from './logger.js';
import { ExpiringCache } from './utils.js';
import { MAX_LENGTH_DIFFERENCE, baseTitle, normalize, plainTitle, versionOf } from './versions.js';

/**
 * The year a song first came out, from MusicBrainz. Spotify dates a song by the album it's on, and
 * iTunes by its releases there; for older songs both often only have reissues and samplers
 * ("Schuld war nur der Bossa Nova", 1963: 1992 on both). MusicBrainz lists the original releases.
 */

export interface YearQuery {
  artist: string;
  title: string;
  durationMs: number; // 0 = unknown
  /** The Spotify album's year: the song can't be younger than an album it's on. */
  latest: number;
}

/** Searches sent to MusicBrainz, how many failed, and the longest wait of one for the budget. */
export interface YearStats {
  lookups: number;
  failed: number;
  waitedMs: number;
}

interface Recording {
  title: string;
  disambiguation?: string;
  video?: boolean | null;
  length?: number | null;
  'artist-credit'?: Array<{ name: string; joinphrase?: string }>;
  /** Every release with this recording; the search sends them all (356 for "Bohemian Rhapsody"). */
  releases?: Array<{ date?: string; status?: string }>;
}

interface SearchResult {
  count: number;
  recordings: Recording[];
}

const SEARCH_URL = 'https://musicbrainz.org/ws/2/recording';
// Songs per search. Ten of them, each up to its Spotify year, mostly match under 100 recordings
// (tests, Oct 2026), so one answer holds them all; a very popular song can fill it on its own.
const BATCH = 10;
const LIMIT = 100;
// A search cut off at LIMIT is asked again below the earliest years found, this often.
const MAX_NARROWING = 3;

// MusicBrainz allows one request per second per IP. On top, it turns away a share of all requests
// when it's busy overall: 503 with "x-ratelimit-zone: global" and "Retry-After: 0", in tests (Oct
// 2026) for a third of them even at a second's pace. The next try mostly passes.
const REFILL_MS = 1000;
const ATTEMPTS = 6;
// A longer Retry-After isn't sat out: the load stops asking instead.
const MAX_RETRY_AFTER_MS = 10_000;
let budget = new TokenBucket(1, REFILL_MS);

/** A fresh budget — for tests, which share this module's state. */
export function resetMusicBrainzLimits(burst = 1): void {
  budget = new TokenBucket(burst, REFILL_MS);
}

// "artist|title|length|latest" → year (null: MusicBrainz knows no original up to `latest`). The
// keys are Spotify metadata, which may only be cached temporarily; same lifetime as iTunes'.
const cache = new ExpiringCache<number | null>(2000, 21 * 60 * 60 * 1000);
const cacheKey = (q: YearQuery) => `${q.artist}|${q.title}|${q.durationMs}|${q.latest}`;

// Lucene's special characters; escaped, "AC/DC" or "Wham!" are searched as written.
const escape = (s: string) => s.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, '\\$&');

/** Recordings of the song by the artist, released by `latest`. */
function clause(q: YearQuery, latest: number): string {
  const title = plainTitle(q.title) || q.title;
  return `(recording:"${escape(title)}" AND artist:"${escape(q.artist)}" AND firstreleasedate:[1900 TO ${latest}])`;
}

/**
 * The earliest official release of a recording that is the song in its original version, null if
 * there is none. Re-recordings, live takes and the like say so in the disambiguation
 * ("re-recording", "live, 1977-01-08: …"); another song of the same name has another length.
 *
 * Only official releases count, not the recording's `first-release-date`: that includes promos
 * ("In Da Club": a 2002 promo single, out in 2003) and doesn't always match any release at all
 * ("Sick and Tired": 2001-01-01 for a 2004 song; tested Oct 2026).
 */
function earliestYear(recordings: Recording[], q: YearQuery, latest: number): number | null {
  const artist = normalize(q.artist);
  const base = baseTitle(q.title);
  const years = recordings.flatMap((r) => {
    const credit = (r['artist-credit'] ?? []).map((a) => a.name + (a.joinphrase ?? '')).join('');
    if (!normalize(credit).includes(artist) || r.video) return [];
    // A title made only of brackets ("(Untitled)") has no base to compare with.
    const sameSong = base ? baseTitle(r.title) === base : normalize(r.title) === normalize(q.title);
    if (!sameSong || versionOf(`${r.title} (${r.disambiguation ?? ''})`) === 'variant') return [];
    const length = r.length ?? 0;
    if (q.durationMs > 0 && length > 0 && Math.abs(length - q.durationMs) > q.durationMs * MAX_LENGTH_DIFFERENCE) {
      return [];
    }
    return (r.releases ?? []).flatMap((release) => {
      const year = parseInt(release.date ?? '', 10);
      return release.status === 'Official' && year >= 1900 && year <= latest ? [year] : [];
    });
  });
  // A popular song brings thousands of releases: too many to spread into Math.min().
  const earliest = years.reduce((a, b) => Math.min(a, b), Infinity);
  return Number.isFinite(earliest) ? earliest : null;
}

// MusicBrainz asks for an application name and a way to reach whoever runs it. Header values
// must be plain ASCII.
function userAgent(): string {
  const contact = (process.env.OPERATOR_CONTACT ?? '').replace(/[^\x20-\x7e]/g, '').trim();
  return `Tuneline/1.0 ( ${contact || 'https://github.com/Sven-Lyco/Tuneline'} )`;
}

/** null: failed (counted) or cancelled (not counted). */
async function search(query: string, songs: number, stats?: YearStats, signal?: AbortSignal): Promise<SearchResult | null> {
  let status = 0;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    let retryAfterMs = 0;
    try {
      const waited = await budget.take(signal);
      if (stats) stats.waitedMs = Math.max(stats.waitedMs, waited);
    } catch {
      return null; // the load was cancelled
    }
    if (stats) stats.lookups++;
    try {
      const response = await fetch(`${SEARCH_URL}?fmt=json&limit=${LIMIT}&query=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': userAgent(), Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      status = response.status;
      if (response.ok) {
        const data = (await response.json()) as Partial<SearchResult> | null;
        if (Array.isArray(data?.recordings)) return { count: Number(data.count) || 0, recordings: data.recordings };
        break; // not an answer to a search
      }
      // 503/429: too many requests; 5xx: down for a moment. A 4xx won't get better by asking again.
      if (status < 500 && status !== 429) break;
      retryAfterMs = (Number(response.headers.get('retry-after')) || 0) * 1000;
      if (retryAfterMs > MAX_RETRY_AFTER_MS) break;
    } catch {
      status = 0; // timeout or network error
    }
    // Otherwise the budget spaces the next try a second apart.
    if (retryAfterMs > 0 && attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
  }
  if (stats) stats.failed++;
  logger.warn({ status, songs }, 'musicbrainz_fetch_error');
  return null;
}

/**
 * Years for songs searched together; undefined: the search failed or was cancelled, so there is
 * no answer to keep. While MusicBrainz cuts the answer off at LIMIT, a song's earliest recording
 * may be among the missing ones: the next search only asks for recordings before the earliest
 * year found so far for each song, and there are few of those.
 */
async function searchSongs(qs: YearQuery[], stats?: YearStats, signal?: AbortSignal): Promise<Array<number | null | undefined>> {
  const earliest: Array<number | null> = qs.map(() => null);
  const latest = qs.map((q) => q.latest);
  for (let round = 0; round <= MAX_NARROWING; round++) {
    const result = await search(qs.map((q, i) => clause(q, latest[i])).join(' OR '), qs.length, stats, signal);
    if (!result) return qs.map(() => undefined);
    const found = qs.map((q, i) => earliestYear(result.recordings, q, latest[i]));
    found.forEach((year, i) => {
      if (year !== null) [earliest[i], latest[i]] = [year, year - 1];
    });
    if (result.count <= result.recordings.length) return earliest;
    if (found.every((year) => year === null)) break; // cut off without a match: nothing to narrow by
  }
  // Still cut off. Searched together, songs crowd each other out; one at a time they may not.
  if (qs.length === 1) return [null];
  const years: Array<number | null | undefined> = [];
  for (const q of qs) years.push(...(await searchSongs([q], stats, signal)));
  return years;
}

/**
 * Per query, the year the song first came out according to MusicBrainz: the earliest release of
 * an original recording by the artist up to the Spotify year. null when MusicBrainz knows none,
 * or couldn't be asked (counted in `stats.failed`). Searches go out in batches of ten songs.
 */
export async function findOriginalYears(
  queries: YearQuery[],
  stats?: YearStats,
  signal?: AbortSignal,
): Promise<Array<number | null>> {
  const years: Array<number | null> = queries.map(() => null);
  const open: number[] = [];
  queries.forEach((q, i) => {
    if (!normalize(q.artist) || !normalize(q.title)) return; // nothing to search for
    const cached = cache.get(cacheKey(q));
    if (cached !== undefined) years[i] = cached;
    else open.push(i);
  });

  for (let start = 0; start < open.length; start += BATCH) {
    const batch = open.slice(start, start + BATCH);
    const found = await searchSongs(
      batch.map((i) => queries[i]),
      stats,
      signal,
    );
    batch.forEach((i, j) => {
      const year = found[j];
      if (year === undefined) return;
      cache.set(cacheKey(queries[i]), year);
      years[i] = year;
    });
  }
  return years;
}
