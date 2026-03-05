interface ItunesTrack {
  previewUrl: string | null;
  trackName: string;
  artistName: string;
}

interface ItunesSearchResult {
  resultCount: number;
  results: ItunesTrack[];
}

export async function findPreview(artist: string, title: string): Promise<string | null> {
  const query = encodeURIComponent(`${artist} ${title}`);
  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${query}&entity=song&limit=5`
    );
    if (!response.ok) return null;

    const data = (await response.json()) as ItunesSearchResult;
    const track = data.results.find((r) => r.previewUrl !== null);
    return track?.previewUrl ?? null;
  } catch {
    return null;
  }
}
