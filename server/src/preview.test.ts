import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findPreview } from './preview.js';

type Track = {
  previewUrl: string | null;
  trackName: string;
  artistName: string;
  collectionName?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
};

const fetchMock = vi.fn();

function itunes(results: Track[], ok = true) {
  fetchMock.mockResolvedValueOnce({ ok, status: ok ? 200 : 429, json: async () => ({ results }) });
}

const track = (
  artistName: string,
  trackName: string,
  previewUrl: string | null = `https://audio/${trackName}`,
): Track => ({ artistName, trackName, previewUrl });

/** A result as iTunes sends it; the preview URL names the album so tests can tell versions apart. */
const release = (artistName: string, trackName: string, collectionName: string, date: string, seconds: number): Track => ({
  artistName,
  trackName,
  collectionName,
  releaseDate: `${date}T07:00:00Z`,
  trackTimeMillis: seconds * 1000,
  previewUrl: `https://audio/${collectionName}/${trackName}`,
});

const preview = async (artist: string, title: string, seconds = 0) =>
  (await findPreview(artist, title, seconds * 1000))?.preview ?? null;

// The cache is module-wide, so every test uses its own artist.
let n = 0;
const artist = () => `Artist ${++n}`;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('findPreview', () => {
  it('takes the same song by the same artist, never a live take or another artist', async () => {
    const a = artist();
    itunes([track(a, 'Dream On (Live)'), track(a, 'Dream On'), track('Other', 'Dream On')]);
    expect(await preview(a, 'Dream On')).toBe('https://audio/Dream On');
  });

  it('accepts remasters and edits when nothing else is there', async () => {
    const a = artist();
    itunes([track(a, 'Bohemian Rhapsody (Remastered 2011)')]);
    expect(await preview(a, 'Bohemian Rhapsody')).toBe('https://audio/Bohemian Rhapsody (Remastered 2011)');

    const b = artist();
    itunes([track(b, 'Shout - Radio Edit')]);
    expect(await preview(b, 'Shout')).toBe('https://audio/Shout - Radio Edit');
  });

  it('ignores accents and case', async () => {
    itunes([track('Beyonce', 'HALO')]);
    expect(await preview('Beyoncé', 'Halo')).toBe('https://audio/HALO');
  });

  it('matches titles made only of brackets exactly', async () => {
    const a = artist();
    itunes([track(a, '[Interlude]'), track(a, '(Untitled)')]);
    expect(await preview(a, '(Untitled)')).toBe('https://audio/(Untitled)');
  });

  it('never falls back to another song or artist', async () => {
    const a = artist();
    itunes([track(a, 'Love'), track('Someone Else', 'Love Me Do')]);
    expect(await preview(a, 'Love Me Do')).toBeNull();
  });

  it('skips results without a preview and titles without letters', async () => {
    const a = artist();
    itunes([track(a, 'Song', null)]);
    expect(await preview(a, 'Song')).toBeNull();
    expect(await preview(artist(), '!!!')).toBeNull();
  });

  it('plays the original recording, not the chopped & screwed one listed first (real iTunes results)', async () => {
    itunes([
      release('Baby Bash', 'Suga Suga (Instrumental)', 'Suga Suga - EP', '2003-01-01', 243),
      release('Baby Bash', 'Suga Suga', 'Screwed & Chopped', '2004-01-01', 380),
      release('Baby Bash', 'Suga Suga', "Tha Smokin' Nephew", '2003-08-15', 239),
      release('Baby Bash', 'Suga Suga (Reggae Remix)', "Tha Smokin' Nephew", '2003-09-23', 245),
      release('Baby Bash', 'Suga Suga (A Cappella)', 'Suga Suga - EP', '2003-01-01', 206),
      release('Baby Bash', 'Suga Suga', 'Suga Suga - EP', '2003-08-15', 243),
      release('ProSource Karaoke Band', 'Suga Suga (Originally Performed by Baby Bash)', 'Karaoke', '2010-08-01', 239),
    ]);
    expect(await findPreview('Baby Bash', 'Suga Suga', 239_000)).toEqual({
      preview: "https://audio/Tha Smokin' Nephew/Suga Suga",
      originalYear: 2003,
    });
  });

  it("finds the original year behind a best-of, and skips re-recordings like Taylor's Version", async () => {
    itunes([
      release('Elvis Presley', 'Suspicious Minds', 'Elv1s: 30 #1 Hits', '1969-08-26', 272),
      release('Elvis Presley', 'Suspicious Minds (Film Edit)', 'ELVIS (Original Motion Picture Soundtrack)', '2022-06-24', 377),
      release('Elvis Presley', 'Suspicious Minds', 'MEMPHIS', '2024-08-09', 206),
      release('Elvis Presley', 'Suspicious Minds (Live)', 'Elvis: As Recorded at Madison Square Garden', '1972-06-18', 261),
      release('Elvis Presley', 'Suspicious Minds', 'From Elvis In Memphis', '1969-08-26', 263),
    ]);
    expect(await findPreview('Elvis Presley', 'Suspicious Minds', 263_000)).toEqual({
      preview: 'https://audio/From Elvis In Memphis/Suspicious Minds',
      originalYear: 1969,
    });

    itunes([
      release('Taylor Swift', 'Love Story (Taylor’s Version)', "Fearless (Taylor's Version)", '2021-02-11', 235),
      release('Taylor Swift', 'Love Story', 'Fearless', '2008-09-12', 235),
      release('Taylor Swift', 'Love Story (Pop mix)', 'Love Story (Pop Mix) - Single', '2009-01-06', 233),
    ]);
    expect(await findPreview('Taylor Swift', 'Love Story', 235_000)).toEqual({
      preview: 'https://audio/Fearless/Love Story',
      originalYear: 2008,
    });
  });

  it('prefers the original over a remaster, then the closest length, then the oldest release', async () => {
    const a = artist();
    itunes([
      release(a, 'Hit (2015 Remastered)', 'Album', '1984-10-19', 228),
      release(a, 'Hit', 'Album (Deluxe Edition)', '1985-06-01', 229),
      release(a, 'Hit', 'Best Of', '1985-06-01', 225),
      release(a, 'Hit', 'Extended Hits', '1970-01-01', 400),
    ]);
    // The remaster still counts for the year; the 400 s take is too long to be the same recording.
    expect(await findPreview(a, 'Hit', 228_000)).toEqual({
      preview: 'https://audio/Album (Deluxe Edition)/Hit',
      originalYear: 1984,
    });
    // Same cached results, another Spotify length: the pick changes, nothing is fetched again.
    expect(await preview(a, 'Hit', 225)).toBe('https://audio/Best Of/Hit');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const b = artist();
    itunes([release(b, 'Song', 'Later', '1999-01-01', 200), release(b, 'Song', 'First', '1990-01-01', 200)]);
    expect(await preview(b, 'Song', 200)).toBe('https://audio/First/Song');
  });

  it("leaves best-ofs out of the year: they carry other tracks' dates (real iTunes results)", async () => {
    itunes([
      release('The Commodores', 'Nightshift', 'Nightshift', '1985-01-01', 303),
      release('The Commodores', 'Nightshift (Single Version)', "Motown: The Complete No. 1's", '1985-01-31', 261),
      release('The Commodores', 'Nightshift (12-Inch Club Mix)', '20th Century Masters - The Millennium Collection', '2002-01-01', 423),
      release('The Commodores', 'Nightshift', 'Anthology', '1977-03-01', 304),
      release('The Commodores', 'Nightshift', 'The Definitive Collection: The Commodores', '1977-03-01', 303),
      release('The Commodores', 'Nightshift', 'Gold: Commodores', '1977-03-01', 304),
    ]);
    // The best-of can still provide the preview; it's the same recording.
    expect(await findPreview('Commodores', 'Nightshift', 304_000)).toEqual({
      preview: 'https://audio/Anthology/Nightshift',
      originalYear: 1985,
    });

    // Only best-ofs: no year from iTunes, Spotify's stands.
    const a = artist();
    itunes([release(a, 'Evergreen', 'Greatest Hits', '1960-05-01', 180)]);
    expect((await findPreview(a, 'Evergreen', 180_000))?.originalYear).toBeNull();
  });

  it('trusts full release dates over January 1st placeholders from compilations (real iTunes results)', async () => {
    itunes([
      release('Michael Jackson', 'Billie Jean', 'Thriller', '1982-11-29', 293),
      release('Michael Jackson', 'Billie Jean', 'Pop Music: The Modern Era 1976-1999', '1966-01-01', 293),
      release('Michael Jackson', 'Billie Jean (Single Version)', 'Number Ones', '1982-11-30', 294),
    ]);
    expect((await findPreview('Michael Jackson', 'Billie Jean', 294_000))?.originalYear).toBe(1982);

    // With only plain years, the earliest one still counts.
    const a = artist();
    itunes([release(a, 'Oldie', 'Best Of', '1999-01-01', 180), release(a, 'Oldie', 'Album', '1964-01-01', 180)]);
    expect((await findPreview(a, 'Oldie', 180_000))?.originalYear).toBe(1964);
  });

  it('drops recordings of a clearly different length, and has no year without dates', async () => {
    const a = artist();
    itunes([release(a, 'Slow Jam', 'Album', '2000-01-01', 380)]);
    expect(await preview(a, 'Slow Jam', 239)).toBeNull();

    const b = artist();
    itunes([track(b, 'Undated')]);
    expect(await findPreview(b, 'Undated', 200_000)).toEqual({ preview: 'https://audio/Undated', originalYear: null });
  });

  it('caches answers but retries after throttling or network errors, and counts both', async () => {
    const a = artist();
    const stats = { lookups: 0, failed: 0 };
    itunes([], false);
    expect(await findPreview(a, 'Hit', 0, stats)).toBeNull();
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await findPreview(a, 'Hit', 0, stats)).toBeNull();
    itunes([track(a, 'Hit')]);
    expect((await findPreview(a, 'Hit', 0, stats))?.preview).toBe('https://audio/Hit');
    expect((await findPreview(a, 'Hit', 0, stats))?.preview).toBe('https://audio/Hit');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // The cache hit isn't a lookup; throttling and the network error are failures.
    expect(stats).toEqual({ lookups: 3, failed: 2 });
  });

  it('evicts the oldest entry once the cache is full', async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ results: [] }) }));
    const first = artist();
    await findPreview(first, 'Oldest');
    for (let i = 0; i < 2000; i++) await findPreview(`Filler ${i}`, 'Song');
    const calls = fetchMock.mock.calls.length;
    await findPreview(first, 'Oldest');
    expect(fetchMock.mock.calls.length).toBe(calls + 1);
  });

  it('asks iTunes for 25 results', async () => {
    itunes([]);
    await findPreview(artist(), 'Anything');
    expect(String(fetchMock.mock.calls[0][0])).toContain('&limit=25');
  });
});
