import type { Request, Response } from 'express';

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

// In-memory cache: "artist|title" → previewUrl | null
const cache = new Map<string, string | null>();

export async function previewHandler(req: Request, res: Response): Promise<void> {
  const artist = String(req.query.artist ?? '').trim();
  const title = String(req.query.title ?? '').trim();

  if (!artist || !title) {
    res.status(400).json({ error: 'Missing artist or title' });
    return;
  }

  const cacheKey = `${artist}|${title}`;

  if (cache.has(cacheKey)) {
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
      cache.set(cacheKey, null);
      res.json({ previewUrl: null });
      return;
    }

    const data = (await response.json()) as ItunesSearchResult;
    const previewUrl = pickBestPreview(data.results, artist, title);
    cache.set(cacheKey, previewUrl);
    res.json({ previewUrl });
  } catch {
    res.json({ previewUrl: null });
  }
}
