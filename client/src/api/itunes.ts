export async function findPreview(artist: string, title: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({ artist, title });
    const response = await fetch(`/api/preview?${params}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { previewUrl: string | null };
    return data.previewUrl;
  } catch {
    return null;
  }
}
