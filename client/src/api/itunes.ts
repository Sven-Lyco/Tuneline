interface ItunesTrack {
  previewUrl: string | null;
  trackName: string;
  artistName: string;
}

interface ItunesSearchResult {
  resultCount: number;
  results: ItunesTrack[];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pickBestTrack(results: ItunesTrack[], artist: string, title: string): ItunesTrack | null {
  const withPreview = results.filter((r) => r.previewUrl !== null);
  if (withPreview.length === 0) return null;

  const normArtist = normalize(artist);
  const normTitle = normalize(title);

  // Prefer: artist matches AND title matches (exact original, not remix/cover)
  const exactMatch = withPreview.find(
    (r) => normalize(r.artistName).includes(normArtist) && normalize(r.trackName) === normTitle
  );
  if (exactMatch) return exactMatch;

  // Fallback: artist matches (any title variant)
  const artistMatch = withPreview.find((r) => normalize(r.artistName).includes(normArtist));
  if (artistMatch) return artistMatch;

  // Last resort: first result with a preview
  return withPreview[0];
}

export async function findPreview(artist: string, title: string): Promise<string | null> {
  const query = encodeURIComponent(`${artist} ${title}`);
  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${query}&entity=song&limit=5`
    );
    if (!response.ok) return null;

    const data = (await response.json()) as ItunesSearchResult;
    const track = pickBestTrack(data.results, artist, title);
    return track?.previewUrl ?? null;
  } catch {
    return null;
  }
}
