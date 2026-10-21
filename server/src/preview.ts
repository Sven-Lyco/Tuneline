import type { Request, Response } from 'express';
import { logger } from './logger.js';

interface ItunesTrack {
  previewUrl: string | null;
  trackName: string;
  artistName: string;
}

interface ItunesSearchResult {
  results: ItunesTrack[];
}

/** Lowercase letters/digits of any script, accents stripped ("Beyoncé" → "beyonce"). */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/** Title without "(Remastered 2011)", "[Live]" or " - Radio Edit" style suffixes. */
function baseTitle(s: string): string {
  return normalize(s.replace(/[([][^)\]]*[)\]]/g, '').split(' - ')[0]);
}

/**
 * Only accepts a result by the same artist whose title matches; a different song
 * by that artist would play while the card shows another title and year.
 */
function pickBestPreview(results: ItunesTrack[], artist: string, title: string): string | null {
  const normArtist = normalize(artist);
  const normTitle = normalize(title);
  const base = baseTitle(title);
  if (!normArtist || !normTitle) return null;

  const byArtist = results.filter(
    (r) => r.previewUrl !== null && normalize(r.artistName).includes(normArtist),
  );
  const exact = byArtist.find((r) => normalize(r.trackName) === normTitle);
  // A title made only of brackets ("(Untitled)") has no base to compare variants with.
  const variant = base ? byArtist.find((r) => baseTitle(r.trackName) === base) : undefined;
  return exact?.previewUrl ?? variant?.previewUrl ?? null;
}

// In-memory cache: "artist|title" → previewUrl | null (max 2000 entries, LRU-eviction)
const cache = new Map<string, string | null>();
const CACHE_MAX = 2000;

function cacheSet(key: string, value: string | null): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

// ── Exported function for internal server use (e.g. server-side song loading) ─

export async function findPreview(artist: string, title: string): Promise<string | null> {
  const cacheKey = `${artist}|${title}`;

  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  try {
    const query = encodeURIComponent(`${artist} ${title}`);
    const response = await fetch(
      `https://itunes.apple.com/search?term=${query}&entity=song&limit=5`,
      { signal: AbortSignal.timeout(6000) },
    );

    // Not cached: 403/429/5xx are transient (iTunes throttling), not "no preview".
    if (!response.ok) {
      logger.warn({ artist, title, status: response.status }, 'itunes_fetch_error');
      return null;
    }

    const data = (await response.json()) as ItunesSearchResult;
    const previewUrl = pickBestPreview(data.results, artist, title);
    logger.debug({ artist, title, found: previewUrl !== null }, 'preview_fetched');
    cacheSet(cacheKey, previewUrl);
    return previewUrl;
  } catch (err) {
    logger.warn({ artist, title, err }, 'itunes_fetch_exception');
    return null;
  }
}

// ── HTTP handler for /api/preview ─────────────────────────────────────────────

export async function previewHandler(req: Request, res: Response): Promise<void> {
  const artist = String(req.query.artist ?? '').trim();
  const title = String(req.query.title ?? '').trim();

  if (!artist || !title) {
    res.status(400).json({ error: 'Missing artist or title' });
    return;
  }

  if (artist.length > 200 || title.length > 200) {
    res.status(400).json({ error: 'Input too long' });
    return;
  }

  res.json({ previewUrl: await findPreview(artist, title) });
}
