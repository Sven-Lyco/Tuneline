import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type YearQuery, findOriginalYears, resetMusicBrainzLimits } from './originalYear.js';

interface Recording {
  title: string;
  'artist-credit': Array<{ name: string; joinphrase?: string }>;
  'first-release-date': string;
  disambiguation: string;
  length: number | null;
  video: boolean | null;
  releases: Array<{ date: string; status: string | null }>;
}

const fetchMock = vi.fn();

const answer = (recordings: Recording[], count = recordings.length) => ({
  ok: true,
  status: 200,
  json: async () => ({ count, recordings }),
});
const failure = (status: number, retryAfter?: string) => ({
  ok: false,
  status,
  headers: new Headers(retryAfter === undefined ? {} : { 'retry-after': retryAfter }),
  json: async () => ({}),
});

/** One search's answer, in the order the searches go out. */
function musicbrainz(recordings: Recording[], count = recordings.length) {
  fetchMock.mockResolvedValueOnce(answer(recordings, count));
}

/**
 * A recording as MusicBrainz sends it, first released officially on `date` (unless `releases`
 * says otherwise).
 */
const rec = (
  title: string,
  artist: string,
  date: string,
  more: { disambiguation?: string; length?: number; video?: boolean; releases?: Recording['releases'] } = {},
): Recording => ({
  title,
  'artist-credit': [{ name: artist }],
  'first-release-date': date,
  disambiguation: more.disambiguation ?? '',
  length: more.length ?? null,
  video: more.video ?? null,
  releases: more.releases ?? [{ date, status: 'Official' }],
});

/** The Lucene query of a search, by its position. */
const sent = (call = 0) => new URL(String(fetchMock.mock.calls[call][0])).searchParams.get('query') ?? '';

const yearOf = async (q: YearQuery, stats?: { lookups: number; failed: number; waitedMs: number }) =>
  (await findOriginalYears([q], stats))[0];

// The cache is module-wide, so every test uses its own artist.
let n = 0;
const artist = () => `Artist ${++n}`;

const stats = () => ({ lookups: 0, failed: 0, waitedMs: 0 });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  resetMusicBrainzLimits(Infinity);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('findOriginalYears', () => {
  it('finds the original year behind reissues and samplers (real MusicBrainz results)', async () => {
    // Spotify and iTunes only know this song from 1992 on; the first single came out in 1963.
    vi.stubEnv('OPERATOR_CONTACT', '');
    musicbrainz([
      rec('Schuld war nur der Bossa Nova', 'Manuela', '1987', { length: 147000 }),
      rec('Schuld war nur der Bossa Nova', 'Manuela', '1993', { length: 166546 }),
      rec('Schuld war nur der Bossa Nova', 'Manuela', '1963', { disambiguation: 'stereo' }),
      rec('Schuld war nur der Bossa Nova', 'Manuela', '1963', { length: 145826 }),
      rec('Schuld war nur der Bossa Nova', 'Manuela', '1987', { disambiguation: 're-recording', length: 144240 }),
    ]);
    const year = await yearOf({ artist: 'Manuela', title: 'Schuld war nur der Bossa Nova', durationMs: 145_040, latest: 1992 });
    expect(year).toBe(1963);

    // Asks for recordings by the artist, under the title, out by the Spotify year.
    expect(sent()).toBe(
      '(recording:"Schuld war nur der Bossa Nova" AND artist:"Manuela" AND firstreleasedate:[1900 TO 1992])',
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/musicbrainz\.org\/ws\/2\/recording\?fmt=json&limit=100&query=/);
    expect(init.headers['User-Agent']).toBe('Tuneline/1.0 ( https://github.com/Sven-Lyco/Tuneline )');
  });

  it('ignores re-recordings, live takes, mixes, videos, other songs, artists and lengths', async () => {
    const a = artist();
    musicbrainz([
      rec('Song', a, '1970', { disambiguation: 're-recording' }),
      rec('Song', a, '1971', { disambiguation: 'live, 1971-05-01: Wembley Arena, London, UK' }),
      rec('Song', a, '1971', { disambiguation: 'part of “Music Machine” DJ‐mix' }),
      rec('Song (club mix)', a, '1972'),
      rec('Song (Neuaufnahme)', a, '1972'),
      rec('Song', a, '1973', { video: true }),
      rec('Song', 'Someone Else', '1960'),
      rec('Song', a, '1965', { length: 400_000 }),
      rec('Song Two', a, '1950'),
      rec('Song', a, '1899'),
      rec('Song', a, ''),
      rec('Song', a, '2005'), // later than Spotify's year
      rec('Song (Radio Edit)', a, '1980', { length: 190_000 }),
      rec('Song', a, '1982-05'),
    ]);
    expect(await yearOf({ artist: a, title: 'Song', durationMs: 200_000, latest: 2000 })).toBe(1980);
  });

  it('counts official releases only, not promos or a first release date no release has (real MusicBrainz results)', async () => {
    musicbrainz([
      rec('In da Club', '50 Cent', '2002', {
        disambiguation: 'single version, clean',
        releases: [
          { date: '2002', status: 'Promotion' },
          { date: '2003', status: 'Official' },
          { date: '2003', status: 'Official' },
        ],
      }),
    ]);
    expect(await yearOf({ artist: '50 Cent', title: 'In Da Club', durationMs: 0, latest: 2003 })).toBe(2003);

    musicbrainz([
      rec('Sick and Tired', 'Anastacia', '2001-01-01', { releases: [{ date: '', status: 'Official' }] }),
      rec('Sick and Tired', 'Anastacia', '2004', {
        releases: [
          { date: '2004', status: 'Official' },
          { date: '2003', status: 'Bootleg' },
          { date: '2003-12', status: null },
        ],
      }),
    ]);
    expect(await yearOf({ artist: 'Anastacia', title: 'Sick and Tired', durationMs: 0, latest: 2004 })).toBe(2004);

    // Without an official release there is no year.
    musicbrainz([rec('Demo Tape', 'Anastacia', '1999', { releases: [{ date: '1999', status: 'Bootleg' }] })]);
    expect(await yearOf({ artist: 'Anastacia', title: 'Demo Tape', durationMs: 0, latest: 2004 })).toBeNull();
  });

  it('matches the artist within a credit, ignoring accents and case', async () => {
    musicbrainz([
      {
        ...rec('HALO', 'Beyonce', '2008-10'),
        'artist-credit': [{ name: 'BEYONCE', joinphrase: ' feat. ' }, { name: 'Someone' }],
      },
    ]);
    expect(await yearOf({ artist: 'Beyoncé', title: 'Halo', durationMs: 0, latest: 2009 })).toBe(2008);
  });

  it('confirms no year MusicBrainz doesn’t know, and remembers that', async () => {
    const q = { artist: artist(), title: 'Unknown', durationMs: 0, latest: 2000 };
    musicbrainz([]);
    expect(await yearOf(q)).toBeNull();
    expect(await yearOf(q)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('searches nothing without letters in artist or title', async () => {
    expect(await findOriginalYears([{ artist: '!!!', title: 'Song', durationMs: 0, latest: 2000 }])).toEqual([null]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks for ten songs at once, and tells their answers apart', async () => {
    const a = artist();
    const queries = Array.from({ length: 12 }, (_, i) => ({ artist: a, title: `Song ${i}`, durationMs: 0, latest: 2000 }));
    musicbrainz(Array.from({ length: 10 }, (_, i) => rec(`Song ${i}`, a, String(1980 + i))));
    musicbrainz([rec('Song 11', a, '1999')]);
    const counts = stats();
    expect(await findOriginalYears(queries, counts)).toEqual([
      1980, 1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989, null, 1999,
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sent(0).split(' OR ')).toHaveLength(10);
    expect(sent(1).split(' OR ')).toHaveLength(2);
    expect(counts).toEqual({ lookups: 2, failed: 0, waitedMs: 0 });

    // Cached songs aren't searched again; only the new one is.
    musicbrainz([rec('New', a, '1990')]);
    expect(await findOriginalYears([queries[3], { ...queries[0], title: 'New' }])).toEqual([1983, 1990]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sent(2).split(' OR ')).toHaveLength(1);
  });

  it('escapes the characters Lucene would read as syntax', async () => {
    musicbrainz([]);
    await findOriginalYears([
      { artist: 'AC/DC', title: 'Highway to Hell', durationMs: 0, latest: 1979 },
      { artist: 'Wham!', title: 'Last "Christmas" - Single Version', durationMs: 0, latest: 1984 },
      { artist: artist(), title: '(Untitled)', durationMs: 0, latest: 2000 },
    ]);
    expect(sent()).toContain('artist:"AC\\/DC"');
    expect(sent()).toContain('recording:"Last \\"Christmas\\"" AND artist:"Wham\\!"');
    expect(sent()).toContain('recording:"\\(Untitled\\)"');
  });

  it('asks again below the earliest years found when a page is cut off (real MusicBrainz results)', async () => {
    const a = artist();
    const queries = [
      { artist: a, title: 'Rare', durationMs: 0, latest: 1992 },
      { artist: a, title: 'Dancing Queen', durationMs: 0, latest: 1992 },
    ];
    // Recordings of a popular song fill a whole page; its original may not be on it.
    musicbrainz(
      Array.from({ length: 100 }, (_, i) => rec('Dancing Queen', a, String(1978 + (i % 10)))),
      160,
    );
    musicbrainz([
      rec('Rare', a, '1970'),
      rec('Dancing Queen', a, '1976-08-15', { disambiguation: 'single/LP/12″ version' }),
      rec('Dancing Queen', a, '1977', { disambiguation: 'part of “Music Machine” DJ‐mix' }),
    ]);
    expect(await findOriginalYears(queries)).toEqual([1970, 1976]);
    // One more search for both: the popular song only before 1978, the other one as before.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sent(1)).toBe(
      `(recording:"Rare" AND artist:"${a}" AND firstreleasedate:[1900 TO 1992]) OR ` +
        `(recording:"Dancing Queen" AND artist:"${a}" AND firstreleasedate:[1900 TO 1977])`,
    );
  });

  it('asks one song at a time when songs searched together keep crowding each other out', async () => {
    const a = artist();
    fetchMock.mockImplementation(async (url: string) => {
      const query = new URL(url).searchParams.get('query') ?? '';
      if (query.includes(' OR ')) return answer([rec('Noise', a, '1970')], 500);
      return answer(query.includes('"One"') ? [rec('One', a, '1971')] : [rec('Two', a, '1972')]);
    });
    const songs = ['One', 'Two'].map((title) => ({ artist: a, title, durationMs: 0, latest: 2000 }));
    expect(await findOriginalYears(songs)).toEqual([1971, 1972]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('confirms no year when the answer stays cut off', async () => {
    const a = artist();
    // Cut off without one matching recording: what's missing could be earlier.
    musicbrainz([rec('Other', a, '1970')], 300);
    expect(await yearOf({ artist: a, title: 'Song', durationMs: 0, latest: 2000 })).toBeNull();

    // Still cut off after narrowing three times.
    fetchMock.mockImplementation(async (url: string) => {
      const latest = Number(/TO (\d+)/.exec(new URL(url).searchParams.get('query') ?? '')![1]);
      return answer([rec('Hit', a, String(latest))], 500);
    });
    expect(await yearOf({ artist: a, title: 'Hit', durationMs: 0, latest: 2000 })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('asks again after 503 or a network error, after Retry-After if given, and gives up after six tries', async () => {
    vi.useFakeTimers();
    const a = artist();
    const counts = stats();
    fetchMock.mockResolvedValueOnce(failure(503, '2')).mockRejectedValueOnce(new Error('offline'));
    musicbrainz([rec('Song', a, '1965')]);
    const year = yearOf({ artist: a, title: 'Song', durationMs: 0, latest: 2000 }, counts);
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await year).toBe(1965);
    expect(counts).toEqual({ lookups: 3, failed: 0, waitedMs: 0 });

    // MusicBrainz busy overall: "Retry-After: 0", every time.
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(failure(503, '0'));
    const failed = stats();
    const q = { artist: a, title: 'Busy', durationMs: 0, latest: 2000 };
    expect(await yearOf(q, failed)).toBeNull();
    expect(failed).toEqual({ lookups: 6, failed: 1, waitedMs: 0 });
    // A failure isn't remembered: the next load asks again.
    await yearOf(q);
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });

  it('gives up at once when MusicBrainz asks to wait long', async () => {
    fetchMock.mockResolvedValueOnce(failure(429, '60'));
    const counts = stats();
    expect(await yearOf({ artist: artist(), title: 'Song', durationMs: 0, latest: 2000 }, counts)).toBeNull();
    expect(counts).toEqual({ lookups: 1, failed: 1, waitedMs: 0 });
  });

  it('does not ask again when the query itself is refused, or the answer is no search result', async () => {
    fetchMock.mockResolvedValueOnce(failure(400));
    const counts = stats();
    expect(await yearOf({ artist: artist(), title: 'Song', durationMs: 0, latest: 2000 }, counts)).toBeNull();
    expect(counts).toEqual({ lookups: 1, failed: 1, waitedMs: 0 });

    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ error: 'Invalid query' }) });
    expect(await yearOf({ artist: artist(), title: 'Song', durationMs: 0, latest: 2000 }, counts)).toBeNull();
    expect(counts).toEqual({ lookups: 2, failed: 2, waitedMs: 0 });
  });

  it('fails all songs of a batch together', async () => {
    const a = artist();
    fetchMock.mockResolvedValue(failure(500));
    const counts = stats();
    const songs = ['One', 'Two'].map((title) => ({ artist: a, title, durationMs: 0, latest: 2000 }));
    expect(await findOriginalYears(songs, counts)).toEqual([null, null]);
    expect(counts).toEqual({ lookups: 6, failed: 1, waitedMs: 0 });
  });

  it('sends one search a second, all hosts together', async () => {
    vi.useFakeTimers();
    resetMusicBrainzLimits();
    const a = artist();
    musicbrainz([rec('First', a, '1970')]);
    musicbrainz([rec('Second', a, '1971')]);
    const counts = stats();
    const first = yearOf({ artist: a, title: 'First', durationMs: 0, latest: 2000 }, counts);
    const second = yearOf({ artist: a, title: 'Second', durationMs: 0, latest: 2000 }, counts);
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect([await first, await second]).toEqual([1970, 1971]);
    expect(counts).toEqual({ lookups: 2, failed: 0, waitedMs: 1000 });
  });

  it('stops waiting when the load is cancelled, without counting a failure', async () => {
    vi.useFakeTimers();
    resetMusicBrainzLimits();
    musicbrainz([]);
    await yearOf({ artist: artist(), title: 'Uses the budget', durationMs: 0, latest: 2000 });
    const cancel = new AbortController();
    const counts = stats();
    const waiting = findOriginalYears([{ artist: artist(), title: 'Never asked', durationMs: 0, latest: 2000 }], counts, cancel.signal);
    cancel.abort();
    expect(await waiting).toEqual([null]);
    expect(counts).toEqual({ lookups: 0, failed: 0, waitedMs: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives MusicBrainz the operator's contact, in plain ASCII", async () => {
    vi.stubEnv('OPERATOR_CONTACT', '✉ ops@example.com ');
    musicbrainz([]);
    await yearOf({ artist: artist(), title: 'Song', durationMs: 0, latest: 2000 });
    expect(fetchMock.mock.calls[0][1].headers['User-Agent']).toBe('Tuneline/1.0 ( ops@example.com )');
  });
});
