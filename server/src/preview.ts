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

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pickBestPreview(results: ItunesTrack[], artist: string, title: string): string | null {
  const withPreview = results.filter((r) => r.previewUrl !== null);
  if (withPreview.length === 0) return null;

  const normArtist = normalize(artist);
  const normTitle = normalize(title);

  const exactMatch = withPreview.find(
    (r) => normalize(r.artistName).includes(normArtist) && normalize(r.trackName) === normTitle,
  );
  if (exactMatch) return exactMatch.previewUrl;

  const artistMatch = withPreview.find((r) => normalize(r.artistName).includes(normArtist));
  if (artistMatch) return artistMatch.previewUrl;

  return withPreview[0].previewUrl ?? null;
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

    if (!response.ok) {
      cacheSet(cacheKey, null);
      return null;
    }

    const data = (await response.json()) as ItunesSearchResult;
    const previewUrl = pickBestPreview(data.results, artist, title);
    cacheSet(cacheKey, previewUrl);
    return previewUrl;
  } catch {
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

  const cacheKey = `${artist}|${title}`;

  if (cache.has(cacheKey)) {
    logger.debug({ artist, title }, 'preview_cache_hit');
    res.json({ previewUrl: cache.get(cacheKey) ?? null });
    return;
  }

  try {
    const query = encodeURIComponent(`${artist} ${title}`);
    const response = await fetch(
      `https://itunes.apple.com/search?term=${query}&entity=song&limit=5`,
      { signal: AbortSignal.timeout(6000) },
    );

    if (!response.ok) {
      logger.warn({ artist, title, status: response.status }, 'itunes_fetch_error');
      cacheSet(cacheKey, null);
      res.json({ previewUrl: null });
      return;
    }

    const data = (await response.json()) as ItunesSearchResult;
    const previewUrl = pickBestPreview(data.results, artist, title);
    logger.debug({ artist, title, found: previewUrl !== null }, 'preview_fetched');
    cacheSet(cacheKey, previewUrl);
    res.json({ previewUrl });
  } catch (err) {
    logger.error({ artist, title, err }, 'itunes_fetch_exception');
    res.json({ previewUrl: null });
  }
}
