import { TokenBucket } from './limits.js';
import { logger } from './logger.js';
import { baseTitle, isCompilationAlbum, normalize, versionOf } from './versions.js';

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
  // iTunes gives a plain year as January 1st, and compilations carry made-up ones ("1966-01-01"
  // for a 1982 song); only a full date is trusted once there is one.
  exactDate: boolean;
  compilation: boolean; // a best-of or reissue: fine to play, but its date says little
  durationMs: number; // 0 = unknown
}

export interface PreviewMatch {
  preview: string;
  /**
   * Earliest year of the song's releases on iTunes, best-ofs and reissues left out (their dates
   * are unreliable). Spotify dates a song by the album it's on. null = unknown.
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
        exactDate: !!r.releaseDate && !/^\d{4}-01-01/.test(r.releaseDate),
        compilation: isCompilationAlbum(r.collectionName ?? ''),
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
  // Without a dated original release there is no year; Spotify's then stands.
  const dated = fitting.filter((c) => c.year >= 1900 && !c.compilation);
  const trusted = dated.some((c) => c.exactDate) ? dated.filter((c) => c.exactDate) : dated;
  const years = trusted.map((c) => c.year);
  return { preview: best.previewUrl, originalYear: years.length > 0 ? Math.min(...years) : null };
}

// In-memory cache: "artist|title" → matching recordings (max 2000 entries, LRU-eviction). The pick
// happens per call, since the Spotify length can differ between two tracks with the same title.
// Entries expire like Apple's own responses (max-age ~21 h); the keys are Spotify metadata, which
// may only be cached temporarily.
const cache = new Map<string, { found: Candidate[]; expiresAt: number }>();
const CACHE_MAX = 2000;
const CACHE_TTL_MS = 21 * 60 * 60 * 1000;

function cacheGet(key: string): Candidate[] | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.found;
}

function cacheSet(key: string, found: Candidate[]): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { found, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── iTunes budget ────────────────────────────────────────────────────────────

// Apple allows "approximately 20 calls per minute" per IP, and all hosts share the server's. A
// burst of 40 kept small games instant in tests (Oct 2026); about 70 within a minute got the IP
// blocked for over half an hour.
const ITUNES_BURST = 40;
const ITUNES_REFILL_MS = 3000;
// After a block iTunes is left alone for a while: asking on only keeps the block going.
const FIRST_COOLDOWN_MS = 2 * 60 * 1000;
const MAX_COOLDOWN_MS = 30 * 60 * 1000;

let budget = new TokenBucket(ITUNES_BURST, ITUNES_REFILL_MS);
let blockedUntil = 0;
let cooldownMs = FIRST_COOLDOWN_MS;

/** A fresh budget and no block — for tests, which share this module's state. */
export function resetItunesLimits(burst = ITUNES_BURST): void {
  budget = new TokenBucket(burst, ITUNES_REFILL_MS);
  blockedUntil = 0;
  cooldownMs = FIRST_COOLDOWN_MS;
}

function isBlocked(): boolean {
  return Date.now() < blockedUntil;
}

/** iTunes refused (403/429): pause, and pause longer if it happens again. */
function block(): void {
  // A whole batch fails at once; that's one block, not several.
  if (isBlocked()) return;
  blockedUntil = Date.now() + cooldownMs;
  logger.warn({ cooldownMs }, 'itunes_throttled');
  cooldownMs = Math.min(cooldownMs * 2, MAX_COOLDOWN_MS);
}

/**
 * iTunes searches that went out (cache misses), how many failed, and the longest wait of one
 * search for the budget — about how much the budget held the load up (searches wait in parallel,
 * so their waits don't add up). Failures show whether song loading still runs into Apple's limit.
 */
export interface PreviewStats {
  lookups: number;
  failed: number;
  waitedMs: number;
}

/**
 * `durationMs`: the Spotify track's length (0 = unknown), to tell recordings apart. `signal` ends
 * the wait for the budget when the load is cancelled.
 */
export async function findPreview(
  artist: string,
  title: string,
  durationMs = 0,
  stats?: PreviewStats,
  signal?: AbortSignal,
): Promise<PreviewMatch | null> {
  const cacheKey = `${artist}|${title}`;

  const cached = cacheGet(cacheKey);
  if (cached) return pickBest(cached, durationMs);

  if (!isBlocked()) {
    try {
      const waited = await budget.take(signal);
      if (stats) stats.waitedMs = Math.max(stats.waitedMs, waited);
    } catch {
      return null; // the load was cancelled
    }
  }
  // Blocked now, or while this search waited: fail without asking.
  if (isBlocked()) {
    if (stats) stats.failed++;
    return null;
  }
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
      if (response.status === 403 || response.status === 429) block();
      logger.warn({ artist, title, status: response.status }, 'itunes_fetch_error');
      return null;
    }
    cooldownMs = FIRST_COOLDOWN_MS;

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
